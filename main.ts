import { Plugin, WorkspaceLeaf, Notice } from "obsidian";

interface PDFPosition {
  scrollTop: number;
  pageNumber?: number;
  timestamp: number;
}

interface PDFHistoryEntry {
  position: PDFPosition;
  filePath: string;
}

export default class PDFCitationNavigatorPlugin extends Plugin {
  private navigationHistory: Map<string, PDFHistoryEntry[]> = new Map();
  private backButtons: Map<string, HTMLElement> = new Map();
  private setupContainers: Set<HTMLElement> = new Set();

  async onload() {
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (leaf) {
          this.handleLeafChange(leaf);
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf) {
          this.handleLeafChange(activeLeaf);
        }
      })
    );

    this.app.workspace.iterateAllLeaves((leaf) => {
      this.handleLeafChange(leaf);
    });
  }

  onunload() {
    this.cleanupAllBackButtons();
  }

  private handleLeafChange(leaf: WorkspaceLeaf) {
    if (leaf.view.getViewType() === "pdf") {
      this.setupPDFViewer(leaf);
    }
  }

  private async setupPDFViewer(leaf: WorkspaceLeaf) {
    const pdfView = leaf.view as any;
    const filePath = pdfView.file?.path;

    if (!filePath) return;

    await this.waitForPDFLoad(leaf);

    const pdfContainer = this.findPDFContainer(leaf);
    this.addBackButton(filePath, pdfContainer);
    this.setupPDFEventListeners(filePath, pdfContainer);
  }

  private async waitForPDFLoad(leaf: WorkspaceLeaf): Promise<void> {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50;

      const checkPDF = () => {
        attempts++;
        const pdfContainer =
          leaf.view.containerEl.querySelector(".pdf-container");

        if (pdfContainer || attempts >= maxAttempts) {
          resolve();
        } else {
          setTimeout(checkPDF, 100);
        }
      };
      checkPDF();
    });
  }

  private findPDFContainer(leaf: WorkspaceLeaf): HTMLElement {
    let container = leaf.view.containerEl.querySelector(
      ".pdf-viewer"
    ) as HTMLElement;

    if (!container) {
      container = leaf.view.containerEl.querySelector(
        ".pdf-container"
      ) as HTMLElement;
    }

    if (!container) {
      container = leaf.view.containerEl;
    }

    return container;
  }

  private findScrollContainer(container: HTMLElement): HTMLElement | null {
    let scrollContainer = container.querySelector(
      ".pdf-viewer-container"
    ) as HTMLElement;

    if (!scrollContainer) {
      scrollContainer = container.querySelector(
        ".pdf-scroll-container"
      ) as HTMLElement;
    }

    if (!scrollContainer) {
      scrollContainer = container.querySelector(
        '[class*="scroll"]'
      ) as HTMLElement;
    }

    if (!scrollContainer && container.scrollHeight > container.clientHeight) {
      scrollContainer = container;
    }

    return scrollContainer;
  }

  private addBackButton(filePath: string, container: HTMLElement) {
    if (this.backButtons.has(filePath)) {
      this.backButtons.get(filePath)?.remove();
    }

    // Add the back button as a floating element in the top-right corner
    const backButton = container.createEl("div", {
      cls: "pdf-citation-back-button clickable-icon",
      text: "← Back",
    });

    backButton.style.cssText = `
      display: none;
      position: absolute;
      top: 12px;
      right: 12px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 14px;
      background-color: var(--background-modifier-border);
      color: var(--text-muted);
      border-radius: 4px;
      font-weight: 400;
      white-space: nowrap;
      z-index: 100;
      opacity: 0.8;
    `;

    backButton.addEventListener("click", () => {
      this.navigateBack(filePath);
    });

    this.backButtons.set(filePath, backButton);
  }

  private setupPDFEventListeners(filePath: string, container: HTMLElement) {
    // Check if we've already set up listeners for this container
    if (this.setupContainers.has(container)) {
      return;
    }

    this.registerDomEvent(container, "click", (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (this.isInternalLink(target)) {
        this.saveCurrentPosition(filePath, container);
        // Prevent the event from bubbling to avoid duplicate saves
        event.stopPropagation();
      }
    });

    this.setupContainers.add(container);
  }

  private isInternalLink(target: HTMLElement): boolean {
    // Check for regular HTML links
    if (target.tagName === "A" || target.closest("a")) {
      const link = target.tagName === "A" ? target : target.closest("a");
      const href = link?.getAttribute("href");

      if (href?.startsWith("#")) {
        return true;
      }
    }

    // Check for PDF.js annotation layer links
    const pdfLinkSection = target.closest(".linkAnnotation, .internalLink");
    if (pdfLinkSection) {
      const hasInternalLinkAttr =
        pdfLinkSection.hasAttribute("data-internal-link");
      const childLink = pdfLinkSection.querySelector("a");
      const isInternalLink =
        hasInternalLinkAttr || childLink?.href?.includes("#");

      return isInternalLink;
    }

    return false;
  }

  private saveCurrentPosition(filePath: string, container: HTMLElement) {
    const scrollContainer = this.findScrollContainer(container);

    if (!scrollContainer) {
      return;
    }

    const currentPosition: PDFPosition = {
      scrollTop: scrollContainer.scrollTop,
      timestamp: Date.now(),
    };

    const entry: PDFHistoryEntry = {
      position: currentPosition,
      filePath: filePath,
    };

    if (!this.navigationHistory.has(filePath)) {
      this.navigationHistory.set(filePath, []);
    }

    const history = this.navigationHistory.get(filePath)!;
    history.push(entry);

    if (history.length > 10) {
      history.shift();
    }

    const backButton = this.backButtons.get(filePath);
    if (backButton) {
      // Check if button is still in the DOM
      if (!backButton.isConnected) {
        // Button was removed, recreate it
        this.addBackButton(filePath, container);
        const newButton = this.backButtons.get(filePath);
        if (newButton) {
          newButton.style.display = "block";
        }
      } else {
        backButton.style.display = "block";
      }
    }
  }

  private navigateBack(filePath: string) {
    const history = this.navigationHistory.get(filePath);
    if (!history || history.length === 0) return;

    const lastPosition = history.pop();
    if (!lastPosition) return;

    const leaf = this.app.workspace.getLeavesOfType("pdf").find((l) => {
      const view = l.view as any;
      return view.file?.path === filePath;
    });

    if (!leaf) return;

    const container = this.findPDFContainer(leaf);
    const scrollContainer = this.findScrollContainer(container);

    if (scrollContainer) {
      scrollContainer.scrollTop = lastPosition.position.scrollTop;
    }

    const backButton = this.backButtons.get(filePath);
    if (backButton && history.length === 0) {
      backButton.style.display = "none";
    }
  }

  private cleanupAllBackButtons() {
    this.backButtons.forEach((button) => {
      button.remove();
    });
    this.backButtons.clear();
    this.setupContainers.clear();
  }
}
