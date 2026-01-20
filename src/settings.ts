export interface MinimalistSettings {
	// Inline Outline
	showOutline: boolean;
	minimalOutline: boolean;
	
	// Distraction-free
	hideProperties: boolean;
	hideScrollbar: boolean;
}

export const DEFAULT_SETTINGS: MinimalistSettings = {
	showOutline: true,
	minimalOutline: false,
	hideProperties: true,
	hideScrollbar: false,
}

export interface OutlineHeading {
	level: number;
	text: string;
	position: {
		start: { line: number; col: number };
		end: { line: number; col: number };
	};
}
