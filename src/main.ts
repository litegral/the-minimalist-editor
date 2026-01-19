import { Plugin, PluginSettingTab, Setting, MarkdownView, debounce } from 'obsidian';
import { InlineOutlineSettings, DEFAULT_SETTINGS, OutlineHeading } from './settings';

const STYLES = `
.inline-outline{position:fixed;right:24px;top:50%;transform:translateY(-50%);z-index:100;display:flex;flex-direction:column;align-items:flex-end;gap:6px;padding:12px 8px;border-radius:6px;background:transparent;max-height:70vh;overflow-y:auto;overflow-x:hidden}
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
.inline-outline-text{font-size:12px;line-height:1.4;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:none;max-width:200px}
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

const READING_LINE_OFFSET = 60;
const LINK_REGEX = /\[\[(?:[^\]|]+\|)?([^\]]+)\]\]|\[([^\]]+)\]\([^)]+\)/g;

export default class InlineOutlinePlugin extends Plugin {
	settings: InlineOutlineSettings;
	private outlineEl: HTMLElement | null = null;
	private activeIndex = -1;
	private headings: OutlineHeading[] = [];
	private headingTexts: string[] = []; // Cached normalized texts
	private scrollContainer: HTMLElement | null = null;
	private isReading = false;
	private scrollRAF: number | null = null;
	private resizeRAF: number | null = null;

	async onload() {
		await this.loadSettings();
		
		// Add styles
		const style = document.createElement('style');
		style.id = 'inline-outline-styles';
		style.textContent = STYLES;
		document.head.appendChild(style);
		this.register(() => style.remove());

		this.addSettingTab(new InlineOutlineSettingTab(this.app, this));
		this.addCommand({ id: 'toggle-outline', name: 'Toggle Inline Outline', callback: () => this.toggle() });

		const refresh = debounce(() => this.refresh(), 300, true);

		this.registerEvent(this.app.workspace.on('active-leaf-change', () => setTimeout(() => this.init(), 100)));
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
		this.scrollContainer?.removeEventListener('scroll', this.onScroll);
		this.outlineEl?.remove();
		if (this.scrollRAF) cancelAnimationFrame(this.scrollRAF);
		if (this.resizeRAF) cancelAnimationFrame(this.resizeRAF);
	}

	private init() {
		this.setupScroll();
		this.refresh();
	}

	private toggle() {
		if (this.outlineEl) {
			this.outlineEl.style.display = this.outlineEl.style.display === 'none' ? '' : 'none';
		}
	}

	private createOutline() {
		this.outlineEl?.remove();
		this.outlineEl = document.createElement('div');
		this.outlineEl.className = 'inline-outline' + (this.settings.minimalStyle ? ' minimal-style' : '');
		this.outlineEl.id = 'inline-outline';
		document.body.appendChild(this.outlineEl);
	}

	updateOutlineStyle() {
		this.outlineEl?.classList.toggle('minimal-style', this.settings.minimalStyle);
	}

	private setupScroll() {
		this.scrollContainer?.removeEventListener('scroll', this.onScroll);
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) { this.scrollContainer = null; return; }

		this.isReading = view.getMode() === 'preview';
		const selector = this.isReading ? '.markdown-preview-view' : '.cm-scroller';
		this.scrollContainer = view.contentEl.querySelector(selector) as HTMLElement;
		this.scrollContainer?.addEventListener('scroll', this.onScroll, { passive: true });
	}

	private onScroll = () => {
		if (this.scrollRAF) return;
		this.scrollRAF = requestAnimationFrame(() => {
			this.scrollRAF = null;
			this.updateActive();
		});
	};

	private observeSidebar() {
		const sidebar = document.querySelector('.mod-right-split');
		if (!sidebar) return;
		new ResizeObserver(() => {
			if (this.resizeRAF) return;
			this.resizeRAF = requestAnimationFrame(() => {
				this.resizeRAF = null;
				this.updatePosition();
			});
		}).observe(sidebar);
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
		
		// Cache normalized texts for matching
		this.headingTexts = this.headings.map(h => this.strip(h.text).toLowerCase());
		
		this.render();
		this.activeIndex = -1;
		
		// Single delayed update for reading mode
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
		this.outlineEl.innerHTML = '';

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
			item.innerHTML = `<div class="inline-outline-line"></div><span class="inline-outline-text">${this.strip(h.text)}</span>`;
			item.onclick = () => this.navigate(i);
			frag.appendChild(item);
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
				
				// Find matching index
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
			const cm = (view?.editor as any)?.cm;
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
			const items = this.outlineEl.querySelectorAll('.inline-outline-item');
			items.forEach((el, i) => el.classList.toggle('active', i === active));
		}
	}

	private navigate(index: number) {
		const h = this.headings[index];
		if (!h) return;

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		// Set active immediately for visual feedback
		this.activeIndex = index;
		this.outlineEl?.querySelectorAll('.inline-outline-item').forEach((el, i) => 
			el.classList.toggle('active', i === index)
		);

		if (this.isReading) {
			// Use Obsidian's native scroll for reading mode - handles virtualization
			const file = this.app.workspace.getActiveFile();
			if (file) {
				// Get the heading text to create a link
				const headingText = h.text;
				// Use the leaf's openLinkText which handles scrolling to headings
				const leaf = this.app.workspace.getLeaf(false);
				if (leaf) {
					this.app.workspace.openLinkText(
						file.path + '#' + headingText,
						file.path,
						false
					);
				}
			}
		} else {
			// Source mode - scroll to line
			const line = h.position.start.line;
			const editor = view.editor;
			
			// Set cursor and scroll into view
			editor.setCursor({ line, ch: 0 });
			editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
		}

		// Don't call updateActive immediately - let the scroll settle
		// The scroll event will naturally update the active heading
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class InlineOutlineSettingTab extends PluginSettingTab {
	plugin: InlineOutlinePlugin;

	constructor(app: any, plugin: InlineOutlinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		this.containerEl.empty();
		this.containerEl.createEl('h2', { text: 'Inline Outline Settings' });

		new Setting(this.containerEl)
			.setName('Minimal Style')
			.setDesc('Notion-like: positioned higher, smaller lines and text')
			.addToggle(t => t.setValue(this.plugin.settings.minimalStyle).onChange(async v => {
				this.plugin.settings.minimalStyle = v;
				await this.plugin.saveSettings();
				this.plugin.updateOutlineStyle();
			}));

		new Setting(this.containerEl)
			.setName('Auto Update')
			.setDesc('Automatically update outline when content changes')
			.addToggle(t => t.setValue(this.plugin.settings.autoUpdate).onChange(async v => {
				this.plugin.settings.autoUpdate = v;
				await this.plugin.saveSettings();
			}));
	}
}
