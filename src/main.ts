import { App, Plugin, PluginSettingTab, Setting, MarkdownView, debounce } from 'obsidian';
import { MinimalistSettings, DEFAULT_SETTINGS, OutlineHeading } from './settings';

const LINK_REGEX = /\[\[(?:[^\]|]+\|)?([^\]]+)\]\]|\[([^\]]+)\]\([^)]+\)/g;
const FOCUS_CLASSES = ['cm-focus-active', 'cm-focus-adjacent', 'focus-active', 'focus-adjacent'];

interface CMEditor {
	state: { doc: { line(n: number): { from: number }; lines: number }; };
	contentDOM: HTMLElement;
	coordsAtPos(pos: number, side?: number): { top: number } | null;
	visibleRanges: { from: number }[];
}

export default class InlineOutlinePlugin extends Plugin {
	settings!: MinimalistSettings;
	private outlineEl: HTMLElement | null = null;
	private outlineItems: HTMLElement[] = [];
	private headings: OutlineHeading[] = [];
	private headingTexts: string[] = [];
	private scrollContainer: HTMLElement | null = null;
	private activeIndex = -1;
	private isReading = false;
	private lastFocusLine = -1;
	private lastFocusIdx = -1;
	private scrollRAF: number | null = null;
	private resizeRAF: number | null = null;
	private focusRAF: number | null = null;
	private sidebarObserver: ResizeObserver | null = null;
	private cleanupFns: (() => void)[] = [];

	async onload() {
		await this.loadSettings();

		this.applyBodyClasses();
		this.updateFocusOpacity();

		this.addSettingTab(new MinimalistSettingTab(this.app, this));
		this.addCommand({ id: 'toggle-outline', name: 'Toggle inline outline', callback: () => this.toggleOutline() });
		this.addCommand({ id: 'toggle-focus-mode', name: 'Toggle focus mode', callback: () => this.toggleFocusMode() });

		const refresh = debounce(() => this.refresh(), 300, true);
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => { this.cleanup(); setTimeout(() => this.init(), 100); }));
		this.registerEvent(this.app.workspace.on('layout-change', () => { this.updatePosition(); setTimeout(() => this.init(), 100); }));
		this.registerEvent(this.app.metadataCache.on('changed', refresh));

		this.app.workspace.onLayoutReady(() => {
			this.createOutline();
			this.observeSidebar();
			setTimeout(() => this.init(), 100);
		});
	}

	onunload() {
		this.cleanup();
		this.outlineEl?.remove();
		[this.scrollRAF, this.resizeRAF, this.focusRAF].forEach(r => r && cancelAnimationFrame(r));
		this.sidebarObserver?.disconnect();
		document.body.classList.remove('minimalist-hide-properties', 'minimalist-hide-scrollbar', 'minimalist-focus-mode');
		this.clearFocusClasses();
	}

	private cleanup() {
		this.cleanupFns.forEach(fn => fn());
		this.cleanupFns = [];
	}

	private init() {
		const view = this.getView();
		if (!view) { this.scrollContainer = null; return; }

		this.isReading = view.getMode() === 'preview';
		this.scrollContainer = view.contentEl.querySelector(this.isReading ? '.markdown-preview-view' : '.cm-scroller');
		
		const onScroll = () => this.scheduleRAF('scrollRAF', () => {
			this.updateActive();
			if (this.settings.focusMode && this.isReading) this.updateFocus();
		});
		
		this.scrollContainer?.addEventListener('scroll', onScroll, { passive: true });
		this.cleanupFns.push(() => this.scrollContainer?.removeEventListener('scroll', onScroll));

		if (this.settings.focusMode && !this.isReading) {
			const cm = this.getCM(view);
			if (cm) {
				const onCursor = () => this.scheduleRAF('focusRAF', () => this.updateFocus());
				document.addEventListener('selectionchange', onCursor);
				cm.contentDOM.addEventListener('keyup', onCursor, { passive: true });
				cm.contentDOM.addEventListener('click', onCursor, { passive: true });
				this.cleanupFns.push(() => {
					document.removeEventListener('selectionchange', onCursor);
					cm.contentDOM.removeEventListener('keyup', onCursor);
					cm.contentDOM.removeEventListener('click', onCursor);
				});
			}
		}

		this.refresh();
		if (this.settings.focusMode) setTimeout(() => this.updateFocus(), 50);
	}

	private scheduleRAF(key: 'scrollRAF' | 'resizeRAF' | 'focusRAF', fn: () => void) {
		if (this[key]) return;
		this[key] = requestAnimationFrame(() => { this[key] = null; fn(); });
	}

	private getView() { return this.app.workspace.getActiveViewOfType(MarkdownView); }
	
	private getCM(view: MarkdownView): CMEditor | null {
		return (view.editor as { cm?: CMEditor })?.cm ?? null;
	}

	private toggleOutline() {
		if (this.outlineEl) this.outlineEl.style.display = this.outlineEl.style.display === 'none' ? '' : 'none';
	}

	private toggleFocusMode() {
		this.settings.focusMode = !this.settings.focusMode;
		void this.saveSettings();
		this.applyBodyClasses();
		if (this.settings.focusMode) {
			this.cleanup();
			this.init();
		} else {
			this.clearFocusClasses();
			this.lastFocusLine = this.lastFocusIdx = -1;
		}
	}

	private createOutline() {
		this.outlineEl?.remove();
		if (!this.settings.showOutline) return;
		this.outlineEl = document.body.createDiv({
			cls: 'inline-outline' + (this.settings.minimalOutline ? ' minimal-style' : ''),
			attr: { id: 'inline-outline' }
		});
	}

	applyBodyClasses() {
		const { classList } = document.body;
		classList.toggle('minimalist-hide-properties', this.settings.hideProperties);
		classList.toggle('minimalist-hide-scrollbar', this.settings.hideScrollbar);
		classList.toggle('minimalist-focus-mode', this.settings.focusMode);
	}

	updateFocusOpacity() {
		document.documentElement.style.setProperty('--focus-dim-opacity', String(this.settings.focusDimOpacity / 100));
	}

	updateOutlineStyle() {
		this.outlineEl?.classList.toggle('minimal-style', this.settings.minimalOutline);
	}

	toggleOutlineVisibility() {
		if (this.settings.showOutline) {
			if (!this.outlineEl) { this.createOutline(); this.refresh(); }
		} else {
			this.outlineEl?.remove();
			this.outlineEl = null;
		}
	}

	private observeSidebar() {
		const sidebar = document.querySelector('.mod-right-split');
		if (!sidebar) return;
		this.sidebarObserver = new ResizeObserver(() => this.scheduleRAF('resizeRAF', () => this.updatePosition()));
		this.sidebarObserver.observe(sidebar);
	}

	private updatePosition() {
		if (!this.outlineEl) return;
		const w = document.querySelector('.mod-right-split')?.getBoundingClientRect().width || 0;
		this.outlineEl.style.right = `${w > 0 ? w + 24 : 24}px`;
	}

	private refresh() {
		const file = this.app.workspace.getActiveFile();
		const cache = file && this.app.metadataCache.getFileCache(file);
		this.headings = cache?.headings?.map(h => ({ level: h.level, text: h.heading, position: h.position })) || [];
		this.headingTexts = this.headings.map(h => this.strip(h.text).toLowerCase());
		this.render();
		this.activeIndex = -1;
		if (this.isReading) {
			setTimeout(() => this.updateActive(), 150);
		} else {
			this.updateActive();
		}
	}

	private strip(text: string) { return text.replace(LINK_REGEX, '$1$2').trim(); }

	private render() {
		if (!this.outlineEl) return;
		this.outlineEl.empty();
		this.outlineItems = [];

		if (!this.headings.length) {
			this.outlineEl.createDiv({ cls: 'inline-outline-empty', text: 'No headings' });
			return;
		}

		const frag = document.createDocumentFragment();
		this.headings.forEach((h, i) => {
			const item = frag.createDiv({ cls: `inline-outline-item inline-outline-level-${h.level}` });
			item.createDiv({ cls: 'inline-outline-line' });
			item.createSpan({ cls: 'inline-outline-text', text: this.strip(h.text) });
			item.addEventListener('click', () => this.navigate(i));
			this.outlineItems.push(item);
		});
		this.outlineEl.appendChild(frag);
	}

	private updateActive() {
		if (!this.outlineEl || !this.headings.length || !this.scrollContainer) return;
		const rect = this.scrollContainer.getBoundingClientRect();
		const threshold = rect.top + rect.height * 0.4;
		const atTop = this.scrollContainer.scrollTop < 50;
		let active = 0;

		if (atTop) {
			// At top of document, always highlight first heading
			active = 0;
		} else if (this.isReading) {
			const view = this.getView();
			const els = Array.from(view?.contentEl.querySelectorAll('.markdown-preview-view :is(h1,h2,h3,h4,h5,h6)') ?? []);
			for (const el of els) {
				const text = (el.textContent || '').toLowerCase().trim();
				let idx = this.headingTexts.indexOf(text);
				if (idx === -1) idx = this.headingTexts.findIndex(t => text.includes(t) || t.includes(text));
				if (idx !== -1 && el.getBoundingClientRect().top <= threshold) active = idx;
			}
		} else {
			const view = this.getView();
			const cm = view && this.getCM(view);
			if (!cm) return;
			for (let i = 0; i < this.headings.length; i++) {
				try {
					const coords = cm.coordsAtPos(cm.state.doc.line(this.headings[i].position.start.line + 1).from, -1);
					if (coords && coords.top <= threshold) active = i;
				} catch { continue; }
			}
		}

		if (active !== this.activeIndex) {
			this.activeIndex = active;
			this.outlineItems.forEach((el, i) => el.classList.toggle('active', i === active));
		}
	}

	private navigate(index: number) {
		const h = this.headings[index];
		if (!h || !this.getView()) return;
		this.activeIndex = index;
		this.outlineItems.forEach((el, i) => el.classList.toggle('active', i === index));
		const file = this.app.workspace.getActiveFile();
		if (file) void this.app.workspace.openLinkText(`${file.path}#${h.text}`, file.path, false);
	}

	private updateFocus() {
		if (!this.settings.focusMode) return;
		const view = this.getView();
		if (!view) return;
		if (this.isReading) {
			this.updateReadingFocus(view);
		} else {
			this.updateEditFocus(view);
		}
	}

	private updateEditFocus(view: MarkdownView) {
		const cm = this.getCM(view);
		if (!cm) return;
		const line = view.editor.getCursor().line;
		if (line === this.lastFocusLine) return;
		this.lastFocusLine = line;

		const lines = cm.contentDOM.querySelectorAll(':scope > .cm-line, :scope > .cm-embed-block');
		if (!lines.length) return;
		lines.forEach(el => el.classList.remove('cm-focus-active', 'cm-focus-adjacent'));

		try {
			const pos = cm.state.doc.line(line + 1).from;
			const coords = cm.coordsAtPos(pos, -1);
			if (!coords) {
				if (line === 0 || (cm.visibleRanges[0] && pos <= cm.visibleRanges[0].from)) {
					lines[0]?.classList.add('cm-focus-active');
					lines[1]?.classList.add('cm-focus-adjacent');
				}
				return;
			}
			const scroller = view.contentEl.querySelector('.cm-scroller');
			const scrollerTop = scroller?.getBoundingClientRect().top ?? 0;
			const cursorRel = coords.top - scrollerTop;
			let activeIdx = -1, minDist = Infinity;
			lines.forEach((el, idx) => {
				const dist = Math.abs(el.getBoundingClientRect().top - scrollerTop - cursorRel);
				if (dist < minDist) { minDist = dist; activeIdx = idx; }
			});
			if (activeIdx >= 0) {
				lines[activeIdx].classList.add('cm-focus-active');
				lines[activeIdx - 1]?.classList.add('cm-focus-adjacent');
				lines[activeIdx + 1]?.classList.add('cm-focus-adjacent');
			} else if (line === 0) {
				lines[0]?.classList.add('cm-focus-active');
				lines[1]?.classList.add('cm-focus-adjacent');
			}
		} catch {
			if (line === 0) { lines[0]?.classList.add('cm-focus-active'); lines[1]?.classList.add('cm-focus-adjacent'); }
		}
	}

	private updateReadingFocus(view: MarkdownView) {
		const preview = view.contentEl.querySelector('.markdown-preview-view') as HTMLElement;
		const sizer = preview?.querySelector('.markdown-preview-sizer');
		if (!sizer || !preview) return;

		const children = Array.from(sizer.children).filter(c => (c as HTMLElement).offsetHeight > 0) as HTMLElement[];
		if (!children.length) return;

		const { top: vTop, bottom: vBottom } = preview.getBoundingClientRect();
		const focusLine = vTop + Math.min(150, (vBottom - vTop) * 0.25);
		let activeIdx = 0, lastAbove = -1, firstVisible = -1;

		for (let i = 0; i < children.length; i++) {
			const { top, bottom } = children[i].getBoundingClientRect();
			if (firstVisible === -1 && bottom > vTop && top < vBottom) firstVisible = i;
			if (top <= focusLine) lastAbove = i;
			if (top <= focusLine && bottom >= focusLine) { activeIdx = i; break; }
			if (top > focusLine) { activeIdx = lastAbove >= 0 ? lastAbove : i; break; }
			if (i === children.length - 1) activeIdx = lastAbove >= 0 ? lastAbove : 0;
		}
		if (activeIdx === 0 && lastAbove === -1 && firstVisible >= 0) activeIdx = firstVisible;
		if (preview.scrollTop <= 10) activeIdx = 0;
		if (activeIdx === this.lastFocusIdx) return;
		this.lastFocusIdx = activeIdx;

		children.forEach((c, i) => {
			c.classList.remove('focus-active', 'focus-adjacent');
			if (i === activeIdx) c.classList.add('focus-active');
			else if (Math.abs(i - activeIdx) === 1) c.classList.add('focus-adjacent');
		});
	}

	private clearFocusClasses() {
		document.querySelectorAll(FOCUS_CLASSES.map(c => `.${c}`).join(',')).forEach(el => 
			FOCUS_CLASSES.forEach(c => el.classList.remove(c))
		);
		this.lastFocusLine = this.lastFocusIdx = -1;
	}

	async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MinimalistSettings> | null); }
	async saveSettings() { await this.saveData(this.settings); }
}

class MinimalistSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: InlineOutlinePlugin) { super(app, plugin); }

	display() {
		const { containerEl } = this;
		containerEl.empty();

		const sections: [string, [string, string, keyof MinimalistSettings, () => void][]][] = [
			['Inline outline', [
				['Show outline', 'Display the inline outline on the right side', 'showOutline', () => this.plugin.toggleOutlineVisibility()],
				['Minimal style', 'Notion-like: positioned higher, smaller elements', 'minimalOutline', () => this.plugin.updateOutlineStyle()],
			]],
			['Distraction-free', [
				['Hide properties', 'Hide properties/metadata from editor (visible in sidebar)', 'hideProperties', () => this.plugin.applyBodyClasses()],
				['Hide scrollbar', 'Hide scrollbar for cleaner appearance', 'hideScrollbar', () => this.plugin.applyBodyClasses()],
			]],
			['Focus mode', [
				['Enable focus mode', 'Dim content except current line/paragraph', 'focusMode', () => {
					this.plugin.applyBodyClasses();
					if (this.plugin.settings.focusMode) {
						this.plugin['cleanup']();
						this.plugin['init']();
					} else {
						this.plugin['clearFocusClasses']();
					}
				}],
			]],
		];

		for (const [title, settings] of sections) {
			new Setting(containerEl).setName(title).setHeading();
			for (const [name, desc, key, onChange] of settings) {
				new Setting(containerEl).setName(name).setDesc(desc).addToggle(t => 
					t.setValue(this.plugin.settings[key] as boolean).onChange(async v => {
						(this.plugin.settings[key] as boolean) = v;
						await this.plugin.saveSettings();
						onChange();
					})
				);
			}
		}

		new Setting(containerEl)
			.setName('Dim opacity')
			.setDesc('How much to dim unfocused content (lower = more dim)')
			.addSlider(s => s.setLimits(10, 70, 5).setValue(this.plugin.settings.focusDimOpacity).setDynamicTooltip()
				.onChange(async v => { this.plugin.settings.focusDimOpacity = v; await this.plugin.saveSettings(); this.plugin.updateFocusOpacity(); }));
	}
}
