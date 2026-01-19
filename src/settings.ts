export interface InlineOutlineSettings {
	autoUpdate: boolean;
	showEmptyState: boolean;
	outlineWidth: number;
	minimalStyle: boolean;
}

export const DEFAULT_SETTINGS: InlineOutlineSettings = {
	autoUpdate: true,
	showEmptyState: true,
	outlineWidth: 250,
	minimalStyle: false,
}

export interface OutlineHeading {
	level: number;
	text: string;
	position: {
		start: {
			line: number;
			col: number;
		};
		end: {
			line: number;
			col: number;
		};
	};
}
