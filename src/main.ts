import { App, Plugin, PluginSettingTab, Setting, MarkdownView, debounce } from 'obsidian';
import { InlineOutlineSettings, DEFAULT_SETTINGS, OutlineHeading } from './settings';

const STYLES = `
/* Notion-style floating outline - right side with lines */
.inline-outline {
	position: fixed;
	right: 24px;
	top: 50%;
	transform: translateY(-50%);
	z-index: 100;
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 6px;
	padding: 12px 8px;
	border-radius: 6px;
	background: transparent;
	max-height: 70vh;
	overflow-y: auto;
	overflow-x: hidden;
}

/* Hover state with background */
.inline-outline:hover {
	background: var(--background-primary);
	box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
	padding: 12px 16px 12px 12px;
	align-items: flex-start;
}

/* Each heading item */
.inline-outline-item {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	cursor: pointer;
	padding: 3px 0;
	width: 100%;
}

.inline-outline:hover .inline-outline-item {
	justify-content: flex-start;
}

/* The line indicator */
.inline-outline-line {
	height: 2px;
	border-radius: 1px;
	background: var(--text-faint);
	opacity: 0.5;
	flex-shrink: 0;
}

.inline-outline-item:hover .inline-outline-line {
	background: var(--text-accent);
	opacity: 1;
}

.inline-outline-item.active .inline-outline-line {
	background: var(--text-accent);
	opacity: 1;
	height: 3px;
}

/* Line widths */
.inline-outline-level-1 .inline-outline-line { width: 28px; }
.inline-outline-level-2 .inline-outline-line { width: 22px; }
.inline-outline-level-3 .inline-outline-line { width: 16px; }
.inline-outline-level-4 .inline-outline-line { width: 12px; }
.inline-outline-level-5 .inline-outline-line { width: 8px; }
.inline-outline-level-6 .inline-outline-line { width: 6px; }

/* Hide line on hover - show text instead */
.inline-outline:hover .inline-outline-line {
	display: none;
}

/* Text label */
.inline-outline-text {
	font-size: 12px;
	line-height: 1.4;
	color: var(--text-muted);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	display: none;
	max-width: 200px;
}

.inline-outline:hover .inline-outline-text {
	display: block;
}

.inline-outline-item:hover .inline-outline-text {
	color: var(--text-normal);
}

.inline-outline-item.active .inline-outline-text {
	color: var(--text-accent);
	font-weight: 500;
}

/* Indentation for heading levels when expanded */
.inline-outline:hover .inline-outline-level-1 { padding-left: 0; }
.inline-outline:hover .inline-outline-level-2 { padding-left: 10px; }
.inline-outline:hover .inline-outline-level-3 { padding-left: 20px; }
.inline-outline:hover .inline-outline-level-4 { padding-left: 30px; }
.inline-outline:hover .inline-outline-level-5 { padding-left: 40px; }
.inline-outline:hover .inline-outline-level-6 { padding-left: 50px; }

/* Font weight by level */
.inline-outline-level-1 .inline-outline-text {
	font-weight: 600;
	font-size: 13px;
}

.inline-outline-level-2 .inline-outline-text {
	font-weight: 500;
}

/* Empty state */
.inline-outline-empty {
	display: none;
}

.inline-outline:hover .inline-outline-empty {
	display: block;
	color: var(--text-faint);
	font-size: 11px;
	white-space: nowrap;
}

/* Scrollbar */
.inline-outline::-webkit-scrollbar {
	width: 4px;
}

.inline-outline::-webkit-scrollbar-track {
	background: transparent;
}

.inline-outline::-webkit-scrollbar-thumb {
	background: var(--background-modifier-border);
	border-radius: 2px;
}

/* Hide on narrow screens */
@media (max-width: 900px) {
	.inline-outline {
		display: none;
	}
}

/* Dark mode */
.theme-dark .inline-outline:hover {
	background: var(--background-secondary);
	box-shadow: 0 2px 16px rgba(0, 0, 0, 0.3);
}

/* ========== MINIMAL STYLE ========== */
/* Notion-like: positioned higher, smaller, more subtle */

.inline-outline.minimal-style {
	top: 120px;
	transform: none;
	gap: 4px;
	padding: 8px 6px;
	max-height: 50vh;
}

.inline-outline.minimal-style:hover {
	padding: 8px 12px 8px 8px;
}

.inline-outline.minimal-style .inline-outline-item {
	padding: 2px 0;
}

/* Smaller line widths for minimal */
.inline-outline.minimal-style .inline-outline-level-1 .inline-outline-line { width: 20px; }
.inline-outline.minimal-style .inline-outline-level-2 .inline-outline-line { width: 16px; }
.inline-outline.minimal-style .inline-outline-level-3 .inline-outline-line { width: 12px; }
.inline-outline.minimal-style .inline-outline-level-4 .inline-outline-line { width: 9px; }
.inline-outline.minimal-style .inline-outline-level-5 .inline-outline-line { width: 6px; }
.inline-outline.minimal-style .inline-outline-level-6 .inline-outline-line { width: 4px; }

.inline-outline.minimal-style .inline-outline-line {
	height: 1.5px;
	opacity: 0.4;
}

.inline-outline.minimal-style .inline-outline-item.active .inline-outline-line {
	height: 2px;
}

/* Smaller text for minimal */
.inline-outline.minimal-style .inline-outline-text {
	font-size: 11px;
	max-width: 160px;
}

.inline-outline.minimal-style .inline-outline-level-1 .inline-outline-text {
	font-size: 11px;
	font-weight: 600;
}

.inline-outline.minimal-style .inline-outline-level-2 .inline-outline-text {
	font-weight: 500;
}

/* Smaller indentation for minimal */
.inline-outline.minimal-style:hover .inline-outline-level-1 { padding-left: 0; }
.inline-outline.minimal-style:hover .inline-outline-level-2 { padding-left: 8px; }
.inline-outline.minimal-style:hover .inline-outline-level-3 { padding-left: 16px; }
.inline-outline.minimal-style:hover .inline-outline-level-4 { padding-left: 24px; }
.inline-outline.minimal-style:hover .inline-outline-level-5 { padding-left: 32px; }
.inline-outline.minimal-style:hover .inline-outline-level-6 { padding-left: 40px; }

.inline-outline.minimal-style .inline-outline-empty {
	font-size: 10px;
}
`;

export default class InlineOutlinePlugin extends Plugin {
	settings: InlineOutlineSettings;
	private outlineEl: HTMLElement | null = null;
	private activeHeadingIndex: number = -1;
	private headings: OutlineHeading[] = [];
	private currentScrollContainer: HTMLElement | null = null;
	private isReadingMode: boolean = false;
	private resizeObserver: ResizeObserver | null = null;
	private scrollRAF: number | null = null;

	async onload() {
		await this.loadSettings();
		this.addStyleSheet();
		this.addSettingTab(new InlineOutlineSettingTab(this.app, this));

		this.addCommand({
			id: 'toggle-outline',
			name: 'Toggle Inline Outline',
			callback: () => this.toggleOutline(),
		});

		// Debounced refresh for content changes
		const debouncedRefresh = debounce(() => this.refreshOutline(), 300, true);

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				// Delay to let view render, then initialize
				setTimeout(() => {
					this.setupScrollListener();
					this.refreshOutline();
					this.updateOutlinePosition();
					// Force initial highlight
					this.activeHeadingIndex = -1;
					this.updateActiveHeadingFromScroll();
				}, 100);
			})
		);

		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				// This fires when switching between source/reading mode
				setTimeout(() => {
					this.setupScrollListener();
					this.refreshOutline();
					// Force re-calculate on mode switch
					this.activeHeadingIndex = -1;
					this.updateActiveHeadingFromScroll();
				}, 100);
				this.updateOutlinePosition();
			})
		);

		this.registerEvent(
			this.app.metadataCache.on('changed', () => {
				debouncedRefresh();
			})
		);

		this.app.workspace.onLayoutReady(() => {
			this.createOutline();
			this.setupSidebarObserver();
			setTimeout(() => {
				this.setupScrollListener();
				this.refreshOutline();
				this.updateOutlinePosition();
			}, 100);
		});
	}

	onunload() {
		this.removeScrollListener();
		this.removeOutline();
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
		}
		if (this.scrollRAF) {
			cancelAnimationFrame(this.scrollRAF);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	addStyleSheet() {
		const style = document.createElement('style');
		style.id = 'inline-outline-styles';
		style.textContent = STYLES;
		document.head.appendChild(style);
		this.register(() => style.remove());
	}

	toggleOutline() {
		if (this.outlineEl) {
			const isHidden = this.outlineEl.style.display === 'none';
			this.outlineEl.style.display = isHidden ? '' : 'none';
		}
	}

	removeOutline() {
		if (this.outlineEl) {
			this.outlineEl.remove();
			this.outlineEl = null;
		}
	}

	removeScrollListener() {
		if (this.currentScrollContainer) {
			this.currentScrollContainer.removeEventListener('scroll', this.onScroll);
			this.currentScrollContainer = null;
		}
	}

	getScrollContainer(): HTMLElement | null {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) return null;

		// Use Obsidian's API to detect the current mode
		// getMode() returns 'source' or 'preview'
		const mode = activeView.getMode();
		
		if (mode === 'preview') {
			// Reading mode
			this.isReadingMode = true;
			const preview = activeView.contentEl.querySelector('.markdown-preview-view');
			if (preview) return preview as HTMLElement;
		} else {
			// Source/Live Preview mode
			this.isReadingMode = false;
			const cmScroller = activeView.contentEl.querySelector('.cm-scroller');
			if (cmScroller) return cmScroller as HTMLElement;
		}

		return null;
	}

	// Use arrow function to preserve 'this' context
	onScroll = () => {
		// Use RAF to throttle scroll updates
		if (this.scrollRAF) return;
		this.scrollRAF = requestAnimationFrame(() => {
			this.scrollRAF = null;
			this.updateActiveHeadingFromScroll();
		});
	};

	setupScrollListener() {
		this.removeScrollListener();
		const scrollContainer = this.getScrollContainer();
		if (scrollContainer) {
			this.currentScrollContainer = scrollContainer;
			scrollContainer.addEventListener('scroll', this.onScroll, { passive: true });
		}
	}

	setupSidebarObserver() {
		const rightSplit = document.querySelector('.mod-right-split');
		if (!rightSplit) return;

		this.resizeObserver = new ResizeObserver(() => {
			this.updateOutlinePosition();
		});
		this.resizeObserver.observe(rightSplit);
	}

	updateOutlinePosition() {
		if (!this.outlineEl) return;

		const rightSplit = document.querySelector('.mod-right-split') as HTMLElement;
		if (rightSplit) {
			const rect = rightSplit.getBoundingClientRect();
			if (rect.width > 0) {
				this.outlineEl.style.right = `${rect.width + 24}px`;
			} else {
				this.outlineEl.style.right = '24px';
			}
		} else {
			this.outlineEl.style.right = '24px';
		}
	}

	createOutline() {
		this.removeOutline();
		this.outlineEl = document.createElement('div');
		this.outlineEl.className = 'inline-outline';
		this.outlineEl.id = 'inline-outline';
		if (this.settings.minimalStyle) {
			this.outlineEl.classList.add('minimal-style');
		}
		document.body.appendChild(this.outlineEl);
	}

	updateOutlineStyle() {
		if (!this.outlineEl) return;
		if (this.settings.minimalStyle) {
			this.outlineEl.classList.add('minimal-style');
		} else {
			this.outlineEl.classList.remove('minimal-style');
		}
	}

	refreshOutline() {
		this.headings = this.getHeadings();
		this.renderOutline();
		
		// Reset and recalculate active heading
		this.activeHeadingIndex = -1;
		
		// For reading mode, wait for DOM to be ready with multiple retries
		if (this.isReadingMode) {
			// Try multiple times as DOM may take time to render
			setTimeout(() => this.updateActiveHeadingFromScroll(), 50);
			setTimeout(() => this.updateActiveHeadingFromScroll(), 150);
			setTimeout(() => this.updateActiveHeadingFromScroll(), 300);
		} else {
			this.updateActiveHeadingFromScroll();
		}
	}

	getHeadings(): OutlineHeading[] {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return [];

		const cache = this.app.metadataCache.getFileCache(activeFile);
		if (!cache || !cache.headings) return [];

		return cache.headings.map((heading) => ({
			level: heading.level,
			text: heading.heading,
			position: heading.position,
		}));
	}

	renderOutline() {
		if (!this.outlineEl) return;
		this.outlineEl.empty();

		if (this.headings.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'inline-outline-empty';
			empty.textContent = 'No headings';
			this.outlineEl.appendChild(empty);
			return;
		}

		this.headings.forEach((heading, index) => {
			const item = document.createElement('div');
			item.className = `inline-outline-item inline-outline-level-${heading.level}`;
			item.dataset.index = String(index);

			const line = document.createElement('div');
			line.className = 'inline-outline-line';

			const text = document.createElement('span');
			text.className = 'inline-outline-text';
			text.textContent = this.stripLinkSyntax(heading.text);

			item.appendChild(line);
			item.appendChild(text);
			item.onclick = () => this.navigateToHeading(heading, index);

			this.outlineEl!.appendChild(item);
		});
	}

	getHeadingElements(): HTMLElement[] {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) return [];

		if (this.isReadingMode) {
			const previewView = activeView.contentEl.querySelector('.markdown-preview-view');
			if (!previewView) return [];
			
			// In reading view, headings are inside .markdown-preview-sizer
			return Array.from(previewView.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];
		}
		return [];
	}

	updateActiveHeadingFromScroll() {
		if (!this.outlineEl || this.headings.length === 0) return;

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) return;

		const scrollContainer = this.currentScrollContainer;
		if (!scrollContainer) return;

		const containerRect = scrollContainer.getBoundingClientRect();
		// The "reading line" - consistent with navigateToHeading offset
		const readingLineOffset = 60;
		const readingLine = containerRect.top + readingLineOffset + 20; // +20 for tolerance

		let activeIndex = 0;

		if (this.isReadingMode) {
			// Reading mode: use DOM elements
			// IMPORTANT: Obsidian virtualizes heading elements, so match by text content
			const headingEls = this.getHeadingElements();
			
			if (headingEls.length > 0) {
				// Build a map of heading text to cache index
				const textToIndex = new Map<string, number>();
				for (let i = 0; i < this.headings.length; i++) {
					const normalizedText = this.stripLinkSyntax(this.headings[i].text).toLowerCase().trim();
					textToIndex.set(normalizedText, i);
				}
				
				// Collect all visible headings with their cache indices and positions
				const visibleHeadings: { cacheIndex: number; top: number }[] = [];
				
				for (const el of headingEls) {
					const rect = el.getBoundingClientRect();
					const elText = (el.textContent || '').toLowerCase().trim();
					
					// Find matching cache index
					let cacheIndex = textToIndex.get(elText);
					if (cacheIndex === undefined) {
						// Try partial match
						for (const [text, idx] of textToIndex) {
							if (elText.includes(text) || text.includes(elText)) {
								cacheIndex = idx;
								break;
							}
						}
					}
					
					if (cacheIndex !== undefined) {
						visibleHeadings.push({ cacheIndex, top: rect.top });
					}
				}
				
				if (visibleHeadings.length > 0) {
					// Sort by position (top to bottom)
					visibleHeadings.sort((a, b) => a.top - b.top);
					
					// Find the first heading that is at or below the reading line
					// OR if all headings are above, use the last one (closest to reading line)
					let found = false;
					for (const h of visibleHeadings) {
						if (h.top >= readingLine - 20) {
							// This heading is at or below the reading line - it's the current section
							activeIndex = h.cacheIndex;
							found = true;
							break;
						}
					}
					
					if (!found) {
						// All visible headings are above the reading line
						// Use the one closest to it (last in sorted order that's above)
						const lastAbove = visibleHeadings[visibleHeadings.length - 1];
						activeIndex = lastAbove.cacheIndex;
					}
				} else {
					// No visible headings - estimate based on scroll position
					const scrollRatio = scrollContainer.scrollTop / (scrollContainer.scrollHeight - scrollContainer.clientHeight);
					activeIndex = Math.min(
						Math.floor(scrollRatio * this.headings.length),
						this.headings.length - 1
					);
				}
			}
		} else {
			// Source mode: use CodeMirror
			const editor = activeView.editor;
			const cmEditor = (editor as any).cm;
			
			if (cmEditor && cmEditor.coordsAtPos) {
				const headingPositions: { index: number; top: number }[] = [];
				
				for (let i = 0; i < this.headings.length; i++) {
					try {
						const line = this.headings[i].position.start.line;
						const lineInfo = cmEditor.state.doc.line(line + 1);
						const coords = cmEditor.coordsAtPos(lineInfo.from, -1);
						if (coords) {
							headingPositions.push({ index: i, top: coords.top });
						}
					} catch (e) {
						continue;
					}
				}
				
				if (headingPositions.length > 0) {
					// Find the first heading at or below the reading line
					let found = false;
					for (const h of headingPositions) {
						if (h.top >= readingLine - 20) {
							activeIndex = h.index;
							found = true;
							break;
						}
					}
					
					if (!found) {
						// All above - use the last one
						activeIndex = headingPositions[headingPositions.length - 1].index;
					}
				}
			}
		}

		if (activeIndex !== this.activeHeadingIndex) {
			this.activeHeadingIndex = activeIndex;
			this.updateOutlineClasses();
		}
	}

	updateOutlineClasses() {
		if (!this.outlineEl) return;
		const items = this.outlineEl.querySelectorAll('.inline-outline-item');
		items.forEach((item, index) => {
			item.classList.toggle('active', index === this.activeHeadingIndex);
		});
	}

	stripLinkSyntax(text: string): string {
		let result = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2');
		result = result.replace(/\[\[([^\]]+)\]\]/g, '$1');
		result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
		return result;
	}

	navigateToHeading(heading: OutlineHeading, index: number) {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) return;

		// The reading line offset - must match the value in updateActiveHeadingFromScroll
		// We scroll the heading to just above this line so it becomes active
		const readingLineOffset = 60;

		if (this.isReadingMode) {
			const headingEls = this.getHeadingElements();
			const scrollContainer = this.currentScrollContainer;
			if (!scrollContainer) return;

			// Find the heading element by matching text content (same as scroll detection)
			const targetText = this.stripLinkSyntax(heading.text).toLowerCase().trim();
			let targetEl: HTMLElement | null = null;
			
			for (const el of headingEls) {
				const elText = (el.textContent || '').toLowerCase().trim();
				if (elText === targetText || elText.includes(targetText) || targetText.includes(elText)) {
					targetEl = el;
					break;
				}
			}
			
			if (targetEl) {
				const containerRect = scrollContainer.getBoundingClientRect();
				const elRect = targetEl.getBoundingClientRect();
				// Scroll so the heading is at the reading line position
				const targetScroll = scrollContainer.scrollTop + (elRect.top - containerRect.top) - readingLineOffset;
				scrollContainer.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
			}
		} else {
			// Source mode - use CodeMirror's scroll
			const line = heading.position.start.line;
			const editor = activeView.editor;
			const cmEditor = (editor as any).cm;
			
			if (cmEditor && cmEditor.coordsAtPos) {
				const scrollContainer = this.currentScrollContainer;
				if (scrollContainer) {
					try {
						const lineInfo = cmEditor.state.doc.line(line + 1);
						const coords = cmEditor.coordsAtPos(lineInfo.from, -1);
						if (coords) {
							const containerRect = scrollContainer.getBoundingClientRect();
							const targetScroll = scrollContainer.scrollTop + (coords.top - containerRect.top) - readingLineOffset;
							scrollContainer.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
						}
					} catch (e) {
						// Fallback to default scroll
						editor.setCursor({ line, ch: 0 });
						editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
					}
				}
			} else {
				editor.setCursor({ line, ch: 0 });
				editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
			}
		}

		this.activeHeadingIndex = index;
		this.updateOutlineClasses();
		setTimeout(() => this.updateActiveHeadingFromScroll(), 400);
	}
}

class InlineOutlineSettingTab extends PluginSettingTab {
	plugin: InlineOutlinePlugin;

	constructor(app: App, plugin: InlineOutlinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Inline Outline Settings' });

		new Setting(containerEl)
			.setName('Minimal Style')
			.setDesc('Notion-like appearance: positioned higher, smaller lines and text')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.minimalStyle)
					.onChange(async (value: boolean) => {
						this.plugin.settings.minimalStyle = value;
						await this.plugin.saveSettings();
						this.plugin.updateOutlineStyle();
					})
			);

		new Setting(containerEl)
			.setName('Auto Update')
			.setDesc('Automatically update outline when content changes')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoUpdate)
					.onChange(async (value: boolean) => {
						this.plugin.settings.autoUpdate = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
