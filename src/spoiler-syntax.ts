/** Regex to match ||spoiler|| syntax */
const SPOILER_REGEX = /\|\|(.+?)\|\|/g;

/**
 * Given raw markdown source text, finds all `||` delimiter occurrences and
 * returns a Set of their ordinal positions (0-indexed) where at least one
 * pipe in the `||` is backslash-escaped in the source.
 *
 * For example, in `\|\|case 9.1\|\| ||real spoiler||`:
 *   - The 1st `||` (ordinal 0) has escaped pipes → included in the set
 *   - The 2nd `||` (ordinal 1) has escaped pipes → included in the set
 *   - The 3rd `||` (ordinal 2) is unescaped → NOT in the set
 *   - The 4th `||` (ordinal 3) is unescaped → NOT in the set
 */
export const findEscapedDelimiters = (rawMarkdown: string): Set<number> => {
	const escaped = new Set<number>();

	// Find all `||` in the raw markdown (after resolving escapes).
	// Walk char by char, tracking escape state, and count `||` pairs.
	let ordinal = 0;
	let i = 0;
	while (i < rawMarkdown.length - 1) {
		// Check for a `||` at this position (where each pipe may or may not be escaped)
		const firstIsEscapedPipe = rawMarkdown[i] === '\\' && rawMarkdown[i + 1] === '|';
		const firstIsPipe = rawMarkdown[i] === '|';

		if (!firstIsEscapedPipe && !firstIsPipe) {
			// Skip escape sequences that aren't pipes
			if (rawMarkdown[i] === '\\' && i + 1 < rawMarkdown.length) {
				i += 2;
			} else {
				i++;
			}
			continue;
		}

		// We found a pipe (escaped or literal) at position i.
		// Now look for the second pipe immediately after.
		const firstLen = firstIsEscapedPipe ? 2 : 1;
		const nextPos = i + firstLen;

		if (nextPos >= rawMarkdown.length) {
			i += firstLen;
			continue;
		}

		const secondIsEscapedPipe = rawMarkdown[nextPos] === '\\' && nextPos + 1 < rawMarkdown.length && rawMarkdown[nextPos + 1] === '|';
		const secondIsPipe = rawMarkdown[nextPos] === '|';

		if (!secondIsEscapedPipe && !secondIsPipe) {
			// Single pipe, not a delimiter
			i += firstLen;
			continue;
		}

		// We found a `||` delimiter (with some combination of escaped/literal pipes)
		const secondLen = secondIsEscapedPipe ? 2 : 1;

		if (firstIsEscapedPipe || secondIsEscapedPipe) {
			escaped.add(ordinal);
		}

		ordinal++;
		i += firstLen + secondLen;
	}

	return escaped;
}

/**
 * Finds all `||` delimiter positions in the given text and returns their
 * character indices along with whether each is escaped (by ordinal lookup).
 * Each spoiler `||content||` uses two delimiters: an opening and a closing.
 */
export const findDelimiterPairs = (text: string, escapedDelimiters: Set<number>, delimiterCounter: { value: number }): { start: number, end: number }[] => {
	SPOILER_REGEX.lastIndex = 0;
	const matches: { start: number, end: number }[] = [];
	let match: RegExpExecArray | null;

	while ((match = SPOILER_REGEX.exec(text)) !== null) {
		const openOrdinal = delimiterCounter.value;
		const closeOrdinal = delimiterCounter.value + 1;
		delimiterCounter.value += 2;

		// Skip if either the opening or closing delimiter is escaped
		if (escapedDelimiters.has(openOrdinal) || escapedDelimiters.has(closeOrdinal)) {
			continue;
		}

		matches.push({ start: match.index, end: match.index + match[0].length });
	}

	return matches;
}
