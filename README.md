# Inline spoilers for Obsidian

This plugin adds support for inline spoilers in [Obsidian](https://obsidian.md) using the `||` syntax.

![Demo gif](https://i.imgur.com/YyfMuJt.gif)

## Usage

To create an inline spoiler, wrap the text you want to hide in `||`, or by performing the **Inline spoilers: Create spoiler** command. For example:

```md
||This text will be hidden||
```

If you want to combine various formatting options, you can nest them, but make sure they are outside the spoiler:

```md
**||This text will be hidden and bolded||**

*||This text will be hidden and italicized||*
```

To reveal or hide a spoiler, click on it. You may opt to always show all spoilers by enabling the **Always show spoilers** setting.

## Bugs and feature requests

Please report any bugs or request features on the [GitHub issues page](https://github.com/logonoff/obsidian-inline-spoilers/issues). Note that the best way to get a feature or bug fix implemented is to submit a pull request. Contributions are always welcome :)

## License

[GPL-3.0-or-later](./LICENCE.md)
