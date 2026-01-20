import { App, Plugin, PluginSettingTab, Setting, MarkdownView, debounce, Editor } from 'obsidian';
import { MinimalistSettings, DEFAULT_SETTINGS, OutlineHeading } from './settings';

const OUTLINE_STYLES = `
:root{--outline-right-offset:24px;--outline-max-width:200px;--outline-breakpoint:900px}
.inline-outline{position:fixed;right:var(--outline-right-offset);top:50%;transform:translateY(-50%);z-index:10;display:flex;flex-direction:column;align-items:flex-end;gap:6px;padding:12px 8px;border-radius:6px;background:transparent;max-height:70vh;overflow-y:auto;overflow-x:hidden}
.inline-outline:hover{background:var(--background-primary);box-shadow:0 2px 12px rgba(0,0,0,.1);padding:12px 16px 12px 12px;align-items:flex-start}
.inline-outline-item{display:flex;align-items:center;justify-content:flex-end;cursor:pointer;padding:3px 0;width:100%}
.inline-outline:hover .inline-outline-item{justify-content:flex-start}
.inline-outline-line{height:2px;border-radius:1px;background:var(--text-faint);opacity:.5;flex-shrink:0}
.inline-outline-item:hover .inline-outline-line{background:var(--text-accent);opacity:1}
.inline-outline-item.active .inline-outline-line{background:var(--text-accent);opacity:1;height:3px}
.inline-outline-level-1 .inline-outline-line{width:28px}
.inline-outline-level-2 .inline-outline-line{width:22px}
.inline-outline-level-3 .inline-outline-line{width:16px}
.inline-outline-level-4 .inline-outline-line{width:12px}
.inline-outline-level-5 .inline-outline-line{width:8px}
.inline-outline-level-6 .inline-outline-line{width:6px}
.inline-outline:hover .inline-outline-line{display:none}
.inline-outline-text{font-size:12px;line-height:1.4;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:none;max-width:var(--outline-max-width)}
.inline-outline:hover .inline-outline-text{display:block}
.inline-outline-item:hover .inline-outline-text{color:var(--text-normal)}
.inline-outline-item.active .inline-outline-text{color:var(--text-accent);font-weight:500}
.inline-outline:hover .inline-outline-level-1{padding-left:0}
.inline-outline:hover .inline-outline-level-2{padding-left:10px}
.inline-outline:hover .inline-outline-level-3{padding-left:20px}
.inline-outline:hover .inline-outline-level-4{padding-left:30px}
.inline-outline:hover .inline-outline-level-5{padding-left:40px}
.inline-outline:hover .inline-outline-level-6{padding-left:50px}
.inline-outline-level-1 .inline-outline-text{font-weight:600;font-size:13px}
.inline-outline-level-2 .inline-outline-text{font-weight:500}
.inline-outline-empty{display:none}
.inline-outline:hover .inline-outline-empty{display:block;color:var(--text-faint);font-size:11px;white-space:nowrap}
.inline-outline::-webkit-scrollbar{width:4px}
.inline-outline::-webkit-scrollbar-track{background:transparent}
.inline-outline::-webkit-scrollbar-thumb{background:var(--background-modifier-border);border-radius:2px}
@media(max-width:900px){.inline-outline{display:none}}
.theme-dark .inline-outline:hover{background:var(--background-secondary);box-shadow:0 2px 16px rgba(0,0,0,.3)}
.inline-outline.minimal-style{top:120px;transform:none;gap:4px;padding:8px 6px;max-height:50vh}
.inline-outline.minimal-style:hover{padding:8px 12px 8px 8px}
.inline-outline.minimal-style .inline-outline-item{padding:2px 0}
.inline-outline.minimal-style .inline-outline-level-1 .inline-outline-line{width:20px}
.inline-outline.minimal-style .inline-outline-level-2 .inline-outline-line{width:16px}
.inline-outline.minimal-style .inline-outline-level-3 .inline-outline-line{width:12px}
.inline-outline.minimal-style .inline-outline-level-4 .inline-outline-line{width:9px}
.inline-outline.minimal-style .inline-outline-level-5 .inline-outline-line{width:6px}
.inline-outline.minimal-style .inline-outline-level-6 .inline-outline-line{width:4px}
.inline-outline.minimal-style .inline-outline-line{height:1.5px;opacity:.4}
.inline-outline.minimal-style .inline-outline-item.active .inline-outline-line{height:2px}
.inline-outline.minimal-style .inline-outline-text{font-size:11px;max-width:160px}
.inline-outline.minimal-style .inline-outline-level-1 .inline-outline-text{font-size:11px;font-weight:600}
.inline-outline.minimal-style .inline-outline-level-2 .inline-outline-text{font-weight:500}
.inline-outline.minimal-style:hover .inline-outline-level-1{padding-left:0}
.inline-outline.minimal-style:hover .inline-outline-level-2{padding-left:8px}
.inline-outline.minimal-style:hover .inline-outline-level-3{padding-left:16px}
.inline-outline.minimal-style:hover .inline-outline-level-4{padding-left:24px}
.inline-outline.minimal-style:hover .inline-outline-level-5{padding-left:32px}
.inline-outline.minimal-style:hover .inline-outline-level-6{padding-left:40px}
.inline-outline.minimal-style .inline-outline-empty{font-size:10px}
`;

// Dynamic styles controlled by body classes
const MINIMALIST_STYLES = `
/* Hide properties/frontmatter from main editor */
body.minimalist-hide-properties .markdown-source-view .metadata-container,
body.minimalist-hide-properties .markdown-preview-view .metadata-container {
	display: none !important;
}
/* Also hide raw YAML frontmatter in source mode */
body.minimalist-hide-properties .cm-line.HyperMD-frontmatter,
body.minimalist-hide-properties .cm-line.HyperMD-frontmatter-begin,
body.minimalist-hide-properties .cm-line.HyperMD-frontmatter-end {
	display: none !important;
}
/* Keep properties visible in sidebar */
body.minimalist-hide-properties .workspace-leaf-content[data-type="file-properties"] .metadata-container {
	display: block !important;
}
/* Style properties in sidebar */
body.minimalist-hide-properties .workspace-leaf-content[data-type="file-properties"] .metadata-properties-heading {
	font-size: 14px;
	color: var(--text-muted);
	font-weight: 500;
	padding: 8px 0;
}
body.minimalist-hide-properties .workspace-leaf-content[data-type="file-properties"] .collapse-indicator {
	display: none !important;
}
body.minimalist-hide-properties .workspace-leaf-content[data-type="file-properties"] .metadata-property {
	padding: 6px 0;
}
body.minimalist-hide-properties .workspace-leaf-content[data-type="file-properties"] .metadata-property-key {
	font-size: 12px;
	color: var(--text-muted);
	font-weight: 500;
}
body.minimalist-hide-properties .workspace-leaf-content[data-type="file-properties"] .metadata-property-value {
	font-size: 14px;
	color: var(--text-normal);
}

/* Hide scrollbar */
body.minimalist-hide-scrollbar .markdown-source-view ::-webkit-scrollbar,
body.minimalist-hide-scrollbar .markdown-preview-view ::-webkit-scrollbar {
	width: 0 !important;
	height: 0 !important;
}
body.minimalist-hide-scrollbar .cm-scroller {
	scrollbar-width: none;
}
`;

// Focus mode styles - injected separately only when enabled
const FOCUS_MODE_STYLES = `
/* Focus Mode - Edit Mode (CodeMirror) */
body.minimalist-focus-mode .markdown-source-view.mod-cm6 .cm-content > .cm-line,
body.minimalist-focus-mode .markdown-source-view.mod-cm6 .cm-content > .cm-embed-block,
body.minimalist-focus-mode .markdown-source-view.mod-cm6 .cm-content > .HyperMD-list-line {
	opacity: var(--focus-dim-opacity, 0.3);
	transition: opacity 0.12s ease-out;
}

/* Active line in edit mode - use Obsidian's native active line detection */
body.minimalist-focus-mode .markdown-source-view.mod-cm6 .cm-content > .cm-active,
body.minimalist-focus-mode .markdown-source-view.mod-cm6 .cm-content > .cm-line.cm-active,
body.minimalist-focus-mode .markdown-source-view.mod-cm6 .cm-content > .cm-focus-active {
	opacity: 1 !important;
}

/* Adjacent lines for smoother transition */
body.minimalist-focus-mode .markdown-source-view.mod-cm6 .cm-content > .cm-focus-adjacent {
	opacity: calc(var(--focus-dim-opacity, 0.3) + 0.3);
}

/* Focus Mode - Reading/Preview Mode */
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > div,
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > p,
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > h1,
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > h2,
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > h3,
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > h4,
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > h5,
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > h6,
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > ul,
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > ol,
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > blockquote,
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > pre,
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > table,
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > hr {
	opacity: var(--focus-dim-opacity, 0.3);
	transition: opacity 0.12s ease-out;
}

body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > .focus-active {
	opacity: 1 !important;
}

body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > .focus-adjacent {
	opacity: calc(var(--focus-dim-opacity, 0.3) + 0.3);
}

/* Ensure code blocks and embeds are also handled */
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > .markdown-embed,
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > .internal-embed {
	opacity: var(--focus-dim-opacity, 0.3);
	transition: opacity 0.12s ease-out;
}

body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > .markdown-embed.focus-active,
body.minimalist-focus-mode .markdown-preview-view .markdown-preview-sizer > .internal-embed.focus-active {
	opacity: 1 !important;
}
`;

const READING_LINE_OFFSET = 60;
const LINK_REGEX = /\[\[(?:[^\]|]+\|)?([^\]]+)\]\]|\[([^\]]+)\]\([^)]+\)/g;

// Type for CodeMirror EditorView with the methods we need
interface CMEditorView {
	state: {
		doc: {
			line(n: number): { from: number; to: number };
			lines: number;
			lineAt(pos: number): { number: number; from: number; to: number };
		};
		selection: {
			main: { head: number; from: number; to: number };
		};
	};
	dom: HTMLElement;
	contentDOM: HTMLElement;
	coordsAtPos(pos: number, side?: number): { top: number; bottom: number; left: number; right: number } | null;
	lineBlockAt(pos: number): { top: number; bottom: number; from: number; to: number };
	visibleRanges: Array<{ from: number; to: number }>;
}

// Interface for Obsidian's Editor with CM access
interface ObsidianEditor extends Editor {
	cm?: CMEditorView;
}

export default class InlineOutlinePlugin extends Plugin {
	settings: MinimalistSettings;
	private outlineEl: HTMLElement | null = null;
	private activeIndex = -1;
	private headings: OutlineHeading[] = [];
	private headingTexts: string[] = [];
	private outlineItems: HTMLElement[] = [];
	private scrollContainer: HTMLElement | null = null;
	private isReading = false;
	private scrollRAF: number | null = null;
	private resizeRAF: number | null = null;
	private focusRAF: number | null = null;
	private sidebarObserver: ResizeObserver | null = null;
	private scrollHandler: (() => void) | null = null;
	
	// Focus mode state
	private focusStyleEl: HTMLStyleElement | null = null;
	private lastFocusLine = -1;
	private lastReadingFocusIdx = -1;
	private focusUpdateDebounced: ReturnType<typeof debounce> | null = null;
	private editorEventCleanup: (() => void) | null = null;

	async onload() {
		await this.loadSettings();
		
		// Add outline styles
		const outlineStyle = document.createElement('style');
		outlineStyle.id = 'minimalist-outline-styles';
		outlineStyle.textContent = OUTLINE_STYLES;
		document.head.appendChild(outlineStyle);
		this.register(() => outlineStyle.remove());

		// Add minimalist styles (properties/scrollbar)
		const minimalistStyle = document.createElement('style');
		minimalistStyle.id = 'minimalist-editor-styles';
		minimalistStyle.textContent = MINIMALIST_STYLES;
		document.head.appendChild(minimalistStyle);
		this.register(() => minimalistStyle.remove());

		// Apply body classes based on settings
		this.applyBodyClasses();
		this.updateFocusOpacity();
		
		// Initialize focus mode if enabled
		if (this.settings.focusMode) {
			this.enableFocusMode();
		}

		this.addSettingTab(new MinimalistSettingTab(this.app, this));
		this.addCommand({ id: 'toggle-outline', name: 'Toggle Inline Outline', callback: () => this.toggle() });
		this.addCommand({ id: 'toggle-focus-mode', name: 'Toggle Focus Mode', callback: () => this.toggleFocusMode() });

		const refresh = debounce(() => this.refresh(), 300, true);
		
		// Create debounced focus update for performance
		this.focusUpdateDebounced = debounce(() => this.updateFocusModeImmediate(), 16, true);

		this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
			this.cleanupEditorEvents();
			setTimeout(() => this.init(), 100);
		}));
		
		this.registerEvent(this.app.workspace.on('layout-change', () => {
			this.updatePosition();
			setTimeout(() => this.init(), 100);
		}));
		
		this.registerEvent(this.app.metadataCache.on('changed', refresh));

		this.app.workspace.onLayoutReady(() => {
			this.createOutline();
			this.observeSidebar();
			setTimeout(() => this.init(), 100);
		});
	}

	onunload() {
		this.cleanupEditorEvents();
		
		if (this.scrollHandler && this.scrollContainer) {
			this.scrollContainer.removeEventListener('scroll', this.scrollHandler);
		}
		this.outlineEl?.remove();
		
		if (this.scrollRAF) cancelAnimationFrame(this.scrollRAF);
		if (this.resizeRAF) cancelAnimationFrame(this.resizeRAF);
		if (this.focusRAF) cancelAnimationFrame(this.focusRAF);
		
		this.sidebarObserver?.disconnect();
		this.sidebarObserver = null;
		
		// Remove focus mode styles
		this.focusStyleEl?.remove();
		this.focusStyleEl = null;
		
		// Remove body classes
		document.body.classList.remove('minimalist-hide-properties', 'minimalist-hide-scrollbar', 'minimalist-focus-mode');
		
		// Clean up focus mode classes
		this.clearFocusClasses();
	}

	private cleanupEditorEvents() {
		if (this.editorEventCleanup) {
			this.editorEventCleanup();
			this.editorEventCleanup = null;
		}
	}

	private init() {
		this.setupScroll();
		this.refresh();
		
		if (this.settings.focusMode) {
			this.setupFocusModeListeners();
			// Initial focus update with delay to ensure DOM is ready
			setTimeout(() => this.updateFocusModeImmediate(), 50);
		}
	}

	private toggle() {
		if (this.outlineEl) {
			this.outlineEl.style.display = this.outlineEl.style.display === 'none' ? '' : 'none';
		}
	}

	private toggleFocusMode() {
		this.settings.focusMode = !this.settings.focusMode;
		this.saveSettings();
		
		if (this.settings.focusMode) {
			this.enableFocusMode();
			this.setupFocusModeListeners();
			this.updateFocusModeImmediate();
		} else {
			this.disableFocusMode();
		}
	}

	private enableFocusMode() {
		// Add focus mode body class
		document.body.classList.add('minimalist-focus-mode');
		
		// Inject focus mode styles if not already present
		if (!this.focusStyleEl) {
			this.focusStyleEl = document.createElement('style');
			this.focusStyleEl.id = 'minimalist-focus-styles';
			this.focusStyleEl.textContent = FOCUS_MODE_STYLES;
			document.head.appendChild(this.focusStyleEl);
		}
	}

	private disableFocusMode() {
		document.body.classList.remove('minimalist-focus-mode');
		this.clearFocusClasses();
		this.cleanupEditorEvents();
		this.lastFocusLine = -1;
		this.lastReadingFocusIdx = -1;
		
		// Note: Keep focusStyleEl to avoid flash on re-enable
		// It will be removed on plugin unload
	}

	private createOutline() {
		this.outlineEl?.remove();
		if (!this.settings.showOutline) return;
		this.outlineEl = document.createElement('div');
		this.outlineEl.className = 'inline-outline' + (this.settings.minimalOutline ? ' minimal-style' : '');
		this.outlineEl.id = 'inline-outline';
		document.body.appendChild(this.outlineEl);
	}

	applyBodyClasses() {
		document.body.classList.toggle('minimalist-hide-properties', this.settings.hideProperties);
		document.body.classList.toggle('minimalist-hide-scrollbar', this.settings.hideScrollbar);
		document.body.classList.toggle('minimalist-focus-mode', this.settings.focusMode);
	}

	updateFocusOpacity() {
		document.documentElement.style.setProperty('--focus-dim-opacity', String(this.settings.focusDimOpacity / 100));
	}

	updateOutlineStyle() {
		this.outlineEl?.classList.toggle('minimal-style', this.settings.minimalOutline);
	}

	toggleOutlineVisibility() {
		if (this.settings.showOutline) {
			if (!this.outlineEl) {
				this.createOutline();
				this.refresh();
			}
		} else {
			this.outlineEl?.remove();
			this.outlineEl = null;
		}
	}

	private setupScroll() {
		if (this.scrollHandler && this.scrollContainer) {
			this.scrollContainer.removeEventListener('scroll', this.scrollHandler);
		}
		
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) { 
			this.scrollContainer = null; 
			this.scrollHandler = null;
			return; 
		}

		this.isReading = view.getMode() === 'preview';
		const selector = this.isReading ? '.markdown-preview-view' : '.cm-scroller';
		this.scrollContainer = view.contentEl.querySelector(selector) as HTMLElement;
		
		this.scrollHandler = () => {
			if (this.scrollRAF) return;
			this.scrollRAF = requestAnimationFrame(() => {
				this.scrollRAF = null;
				this.updateActive();
				
				// Only update focus in reading mode on scroll
				// Edit mode uses cursor position, not scroll
				if (this.settings.focusMode && this.isReading) {
					this.focusUpdateDebounced?.();
				}
			});
		};
		
		this.scrollContainer?.addEventListener('scroll', this.scrollHandler, { passive: true });
	}

	private setupFocusModeListeners() {
		if (!this.settings.focusMode) return;
		
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		// Clean up previous listeners
		this.cleanupEditorEvents();

		if (!this.isReading) {
			// For edit mode, we need to listen to cursor changes
			const editor = view.editor as ObsidianEditor;
			const cm = editor?.cm;
			
			if (cm) {
				// Use a MutationObserver on the content DOM to detect cursor changes
				// This is more reliable than trying to hook into CM6 directly
				const contentDOM = cm.contentDOM;
				
				// Listen for selection changes via the 'selectionchange' event
				const selectionHandler = () => {
					if (this.focusRAF) return;
					this.focusRAF = requestAnimationFrame(() => {
						this.focusRAF = null;
						this.updateEditModeFocus(view);
					});
				};
				
				document.addEventListener('selectionchange', selectionHandler);
				
				// Also listen for keyboard input which might change cursor
				const keyHandler = () => {
					if (this.focusRAF) return;
					this.focusRAF = requestAnimationFrame(() => {
						this.focusRAF = null;
						this.updateEditModeFocus(view);
					});
				};
				
				contentDOM.addEventListener('keyup', keyHandler, { passive: true });
				contentDOM.addEventListener('click', keyHandler, { passive: true });
				
				this.editorEventCleanup = () => {
					document.removeEventListener('selectionchange', selectionHandler);
					contentDOM.removeEventListener('keyup', keyHandler);
					contentDOM.removeEventListener('click', keyHandler);
				};
			}
		}
	}

	private observeSidebar() {
		const sidebar = document.querySelector('.mod-right-split');
		if (!sidebar) return;
		
		this.sidebarObserver = new ResizeObserver(() => {
			if (this.resizeRAF) return;
			this.resizeRAF = requestAnimationFrame(() => {
				this.resizeRAF = null;
				this.updatePosition();
			});
		});
		this.sidebarObserver.observe(sidebar);
	}

	private updatePosition() {
		if (!this.outlineEl) return;
		const sidebar = document.querySelector('.mod-right-split') as HTMLElement;
		const width = sidebar?.getBoundingClientRect().width || 0;
		this.outlineEl.style.right = `${width > 0 ? width + 24 : 24}px`;
	}

	private refresh() {
		const file = this.app.workspace.getActiveFile();
		const cache = file && this.app.metadataCache.getFileCache(file);
		
		this.headings = cache?.headings?.map(h => ({
			level: h.level, text: h.heading, position: h.position
		})) || [];
		
		this.headingTexts = this.headings.map(h => this.strip(h.text).toLowerCase());
		
		this.render();
		this.activeIndex = -1;
		
		if (this.isReading) {
			setTimeout(() => this.updateActive(), 150);
		} else {
			this.updateActive();
		}
	}

	private strip(text: string): string {
		return text.replace(LINK_REGEX, '$1$2').trim();
	}

	private render() {
		if (!this.outlineEl) return;
		this.outlineEl.empty();
		this.outlineItems = [];

		if (!this.headings.length) {
			const empty = document.createElement('div');
			empty.className = 'inline-outline-empty';
			empty.textContent = 'No headings';
			this.outlineEl.appendChild(empty);
			return;
		}

		const frag = document.createDocumentFragment();
		this.headings.forEach((h, i) => {
			const item = document.createElement('div');
			item.className = `inline-outline-item inline-outline-level-${h.level}`;
			
			const line = document.createElement('div');
			line.className = 'inline-outline-line';
			
			const text = document.createElement('span');
			text.className = 'inline-outline-text';
			text.textContent = this.strip(h.text);
			
			item.appendChild(line);
			item.appendChild(text);
			item.addEventListener('click', () => this.navigate(i));
			
			frag.appendChild(item);
			this.outlineItems.push(item);
		});
		this.outlineEl.appendChild(frag);
	}

	private updateActive() {
		if (!this.outlineEl || !this.headings.length || !this.scrollContainer) return;

		const rect = this.scrollContainer.getBoundingClientRect();
		const readingLine = rect.top + READING_LINE_OFFSET + 20;
		let active = 0;

		if (this.isReading) {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			const preview = view?.contentEl.querySelector('.markdown-preview-view');
			if (!preview) return;

			const els = Array.from(preview.querySelectorAll('h1,h2,h3,h4,h5,h6'));
			let lastAbove = 0;

			for (const el of els) {
				const top = el.getBoundingClientRect().top;
				const text = (el.textContent || '').toLowerCase().trim();
				
				let idx = this.headingTexts.indexOf(text);
				if (idx === -1) {
					idx = this.headingTexts.findIndex(t => text.includes(t) || t.includes(text));
				}
				if (idx === -1) continue;

				if (top <= readingLine) lastAbove = idx;
				if (top >= readingLine - 20) { active = idx; break; }
			}
			if (active === 0 && lastAbove > 0) active = lastAbove;
		} else {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			const cm = (view?.editor as ObsidianEditor)?.cm;
			if (!cm?.coordsAtPos) return;

			let lastAbove = 0;
			for (let i = 0; i < this.headings.length; i++) {
				try {
					const line = this.headings[i].position.start.line;
					const coords = cm.coordsAtPos(cm.state.doc.line(line + 1).from, -1);
					if (!coords) continue;
					if (coords.top <= readingLine) lastAbove = i;
					if (coords.top >= readingLine - 20) { active = i; break; }
				} catch { continue; }
			}
			if (active === 0 && lastAbove > 0) active = lastAbove;
		}

		if (active !== this.activeIndex) {
			this.activeIndex = active;
			this.outlineItems.forEach((el, i) => el.classList.toggle('active', i === active));
		}
	}

	private navigate(index: number) {
		const h = this.headings[index];
		if (!h) return;

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		this.activeIndex = index;
		this.outlineItems.forEach((el, i) => el.classList.toggle('active', i === index));

		const file = this.app.workspace.getActiveFile();
		if (file) {
			this.app.workspace.openLinkText(
				file.path + '#' + h.text,
				file.path,
				false
			);
		}
	}

	// Focus Mode methods
	private updateFocusModeImmediate() {
		if (!this.settings.focusMode) return;

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		if (this.isReading) {
			this.updateReadingModeFocus(view);
		} else {
			this.updateEditModeFocus(view);
		}
	}

	private updateEditModeFocus(view: MarkdownView) {
		const editor = view.editor as ObsidianEditor;
		const cm = editor?.cm;
		if (!cm) return;

		// Get current cursor line
		const cursor = view.editor.getCursor();
		const currentLine = cursor.line;

		// Skip if same line (avoid unnecessary DOM updates)
		if (currentLine === this.lastFocusLine) return;
		this.lastFocusLine = currentLine;

		// Get the content container
		const contentDOM = cm.contentDOM;
		if (!contentDOM) return;

		// Get all line elements - these are the direct children of cm-content
		const lineElements = contentDOM.querySelectorAll(':scope > .cm-line, :scope > .cm-embed-block');
		if (!lineElements.length) return;

		// Clear all focus classes first
		lineElements.forEach(el => {
			el.classList.remove('cm-focus-active', 'cm-focus-adjacent');
		});

		// Find the active line element using CM6's line positions
		try {
			const cursorPos = cm.state.doc.line(currentLine + 1).from;
			const cursorCoords = cm.coordsAtPos(cursorPos, -1);
			
			if (!cursorCoords) {
				// Fallback: if we can't get coords, try to find by checking visible ranges
				// This handles the case when cursor is at line 0 or document start
				const visibleRanges = cm.visibleRanges;
				if (visibleRanges.length > 0 && lineElements.length > 0) {
					// If cursor is at or before first visible position, highlight first line
					if (cursorPos <= visibleRanges[0].from || currentLine === 0) {
						lineElements[0].classList.add('cm-focus-active');
						if (lineElements.length > 1) {
							lineElements[1].classList.add('cm-focus-adjacent');
						}
					}
				}
				return;
			}

			const scroller = view.contentEl.querySelector('.cm-scroller');
			const scrollerRect = scroller?.getBoundingClientRect();
			if (!scrollerRect) return;

			const cursorRelTop = cursorCoords.top - scrollerRect.top;
			
			// Find the line element that matches cursor position
			let activeIdx = -1;
			let minDist = Infinity;
			
			lineElements.forEach((el, idx) => {
				const rect = el.getBoundingClientRect();
				const elRelTop = rect.top - scrollerRect.top;
				const dist = Math.abs(elRelTop - cursorRelTop);
				
				if (dist < minDist) {
					minDist = dist;
					activeIdx = idx;
				}
			});

			// Apply classes
			if (activeIdx >= 0) {
				lineElements[activeIdx].classList.add('cm-focus-active');
				
				// Adjacent lines
				if (activeIdx > 0) {
					lineElements[activeIdx - 1].classList.add('cm-focus-adjacent');
				}
				if (activeIdx < lineElements.length - 1) {
					lineElements[activeIdx + 1].classList.add('cm-focus-adjacent');
				}
			} else if (currentLine === 0 && lineElements.length > 0) {
				// Edge case: cursor at line 0, highlight first visible line
				lineElements[0].classList.add('cm-focus-active');
				if (lineElements.length > 1) {
					lineElements[1].classList.add('cm-focus-adjacent');
				}
			}
		} catch (e) {
			// Fallback for any errors: if at line 0, highlight first element
			if (currentLine === 0 && lineElements.length > 0) {
				lineElements[0].classList.add('cm-focus-active');
				if (lineElements.length > 1) {
					lineElements[1].classList.add('cm-focus-adjacent');
				}
			}
		}
	}

	private updateReadingModeFocus(view: MarkdownView) {
		const preview = view.contentEl.querySelector('.markdown-preview-view') as HTMLElement;
		const sizer = preview?.querySelector('.markdown-preview-sizer') as HTMLElement;
		if (!sizer || !preview) return;

		// Get focusable elements (direct children that are content blocks)
		const selector = ':scope > div, :scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > ul, :scope > ol, :scope > blockquote, :scope > pre, :scope > table, :scope > hr, :scope > .markdown-embed, :scope > .internal-embed';
		const children = Array.from(sizer.querySelectorAll(selector)) as HTMLElement[];
		
		if (!children.length) return;

		const previewRect = preview.getBoundingClientRect();
		const viewportTop = previewRect.top;
		const viewportBottom = previewRect.bottom;
		
		// Reading line position - where we consider content "in focus"
		// Use a position near the top of the visible area for better UX
		const focusLine = viewportTop + Math.min(150, (viewportBottom - viewportTop) * 0.25);
		
		let activeIdx = 0;
		let lastAboveIdx = -1;
		let firstVisibleIdx = -1;

		for (let idx = 0; idx < children.length; idx++) {
			const child = children[idx];
			const rect = child.getBoundingClientRect();
			
			// Skip elements with no height
			if (rect.height === 0) continue;
			
			const elementTop = rect.top;
			const elementBottom = rect.bottom;
			
			// Track first visible element
			if (firstVisibleIdx === -1 && elementBottom > viewportTop && elementTop < viewportBottom) {
				firstVisibleIdx = idx;
			}
			
			// Element is above or at the focus line
			if (elementTop <= focusLine) {
				lastAboveIdx = idx;
			}
			
			// Element crosses the focus line - this is our active element
			if (elementTop <= focusLine && elementBottom >= focusLine) {
				activeIdx = idx;
				break;
			}
			
			// Element is below focus line - use last element that was above
			if (elementTop > focusLine) {
				activeIdx = lastAboveIdx >= 0 ? lastAboveIdx : idx;
				break;
			}
			
			// If we've gone through all elements, use the last one that was above
			if (idx === children.length - 1) {
				activeIdx = lastAboveIdx >= 0 ? lastAboveIdx : 0;
			}
		}
		
		// Edge case: if at very top and no element is above focus line, use first visible
		if (activeIdx === 0 && lastAboveIdx === -1 && firstVisibleIdx >= 0) {
			activeIdx = firstVisibleIdx;
		}
		
		// Edge case: completely scrolled to top - always highlight first element
		if (preview.scrollTop <= 10 && children.length > 0) {
			activeIdx = 0;
		}

		// Skip if same element (avoid unnecessary DOM updates)
		if (activeIdx === this.lastReadingFocusIdx) return;
		this.lastReadingFocusIdx = activeIdx;

		// Update classes
		children.forEach((child, idx) => {
			child.classList.remove('focus-active', 'focus-adjacent');
			
			if (idx === activeIdx) {
				child.classList.add('focus-active');
			} else if (Math.abs(idx - activeIdx) === 1) {
				child.classList.add('focus-adjacent');
			}
		});
	}

	private clearFocusClasses() {
		// Clear edit mode classes from current view
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) {
			const contentEl = view.contentEl;
			contentEl.querySelectorAll('.cm-focus-active, .cm-focus-adjacent').forEach(el => {
				el.classList.remove('cm-focus-active', 'cm-focus-adjacent');
			});
			contentEl.querySelectorAll('.focus-active, .focus-adjacent').forEach(el => {
				el.classList.remove('focus-active', 'focus-adjacent');
			});
		}
		
		// Also clear globally in case of lingering elements
		document.querySelectorAll('.cm-focus-active, .cm-focus-adjacent, .focus-active, .focus-adjacent').forEach(el => {
			el.classList.remove('cm-focus-active', 'cm-focus-adjacent', 'focus-active', 'focus-adjacent');
		});
		
		this.lastFocusLine = -1;
		this.lastReadingFocusIdx = -1;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class MinimalistSettingTab extends PluginSettingTab {
	plugin: InlineOutlinePlugin;

	constructor(app: App, plugin: InlineOutlinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		this.containerEl.empty();
		this.containerEl.createEl('h2', { text: 'The Minimalist Editor' });

		// Outline Section
		this.containerEl.createEl('h3', { text: 'Inline Outline' });

		new Setting(this.containerEl)
			.setName('Show Outline')
			.setDesc('Display the inline outline on the right side of the editor')
			.addToggle(t => t.setValue(this.plugin.settings.showOutline).onChange(async v => {
				this.plugin.settings.showOutline = v;
				await this.plugin.saveSettings();
				this.plugin.toggleOutlineVisibility();
			}));

		new Setting(this.containerEl)
			.setName('Minimal Style')
			.setDesc('Notion-like: positioned higher, smaller lines and text')
			.addToggle(t => t.setValue(this.plugin.settings.minimalOutline).onChange(async v => {
				this.plugin.settings.minimalOutline = v;
				await this.plugin.saveSettings();
				this.plugin.updateOutlineStyle();
			}));

		// Distraction-free Section
		this.containerEl.createEl('h3', { text: 'Distraction-free' });

		new Setting(this.containerEl)
			.setName('Hide Properties')
			.setDesc('Hide the properties/metadata panel from the editor (still visible in sidebar)')
			.addToggle(t => t.setValue(this.plugin.settings.hideProperties).onChange(async v => {
				this.plugin.settings.hideProperties = v;
				await this.plugin.saveSettings();
				this.plugin.applyBodyClasses();
			}));

		new Setting(this.containerEl)
			.setName('Hide Scrollbar')
			.setDesc('Hide the scrollbar for a cleaner appearance')
			.addToggle(t => t.setValue(this.plugin.settings.hideScrollbar).onChange(async v => {
				this.plugin.settings.hideScrollbar = v;
				await this.plugin.saveSettings();
				this.plugin.applyBodyClasses();
			}));

		// Focus Mode Section
		this.containerEl.createEl('h3', { text: 'Focus Mode' });

		new Setting(this.containerEl)
			.setName('Enable Focus Mode')
			.setDesc('Dim content except the current line/paragraph for distraction-free writing')
			.addToggle(t => t.setValue(this.plugin.settings.focusMode).onChange(async v => {
				this.plugin.settings.focusMode = v;
				await this.plugin.saveSettings();
				
				if (v) {
					this.plugin.applyBodyClasses();
					// Trigger focus mode setup - need to reinit
					const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
					if (view) {
						// Small delay to ensure styles are applied
						setTimeout(() => {
							(this.plugin as InlineOutlinePlugin)['enableFocusMode']();
							(this.plugin as InlineOutlinePlugin)['setupFocusModeListeners']();
							(this.plugin as InlineOutlinePlugin)['updateFocusModeImmediate']();
						}, 50);
					}
				} else {
					(this.plugin as InlineOutlinePlugin)['disableFocusMode']();
				}
			}));

		new Setting(this.containerEl)
			.setName('Dim Opacity')
			.setDesc('How much to dim unfocused content (lower = more dim)')
			.addSlider(s => s
				.setLimits(10, 70, 5)
				.setValue(this.plugin.settings.focusDimOpacity)
				.setDynamicTooltip()
				.onChange(async v => {
					this.plugin.settings.focusDimOpacity = v;
					await this.plugin.saveSettings();
					this.plugin.updateFocusOpacity();
				}));
	}
}
