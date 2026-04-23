export interface MinimalistSettings {
	// Inline Outline
	showOutline: boolean;
	minimalOutline: boolean;
	
	// Distraction-free
	hideProperties: boolean;
	hideScrollbar: boolean;
	autoHideUI: boolean; // Added for Notion-style auto-hide
	
	// Focus Mode
	focusMode: boolean;
	focusDimOpacity: number; // 0-100, percentage of dimming for unfocused content
}

export const DEFAULT_SETTINGS: MinimalistSettings = {
	showOutline: true,
	minimalOutline: false,
	hideProperties: true,
	hideScrollbar: false,
	autoHideUI: false, // Defaulting to false so it doesn't surprise users
	focusMode: false,
	focusDimOpacity: 30,
}

export interface OutlineHeading {
	level: number;
	text: string;
	position: {
		start: { line: number; col: number };
		end: { line: number; col: number };
	};
}