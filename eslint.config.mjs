import js from "@eslint/js";
import obsidian from "eslint-plugin-obsidianmd";
import { defineConfig, globalIgnores } from "eslint/config";
import ts from "typescript-eslint";

export default defineConfig(
	js.configs.recommended,
	...ts.configs.recommended,
	...obsidian.configs.recommended,
	{
		rules: {
			// https://typescript-eslint.io/troubleshooting/faqs/eslint
			"no-undef": "off",
		},
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.mjs',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.mjs",
		"version-bump.mjs",
		"versions.json",
		"main.js",
	]),
);
