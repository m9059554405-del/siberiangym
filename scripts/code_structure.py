from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable

SOURCE_EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}
DEFAULT_EXCLUDED_DIRS = {".git", "node_modules", "dist", "build", ".venv", "venv", "__pycache__"}


@dataclass
class Symbol:
    kind: str
    name: str
    qualified_name: str
    signature: str
    start_line: int
    end_line: int
    docstring: str | None = None


@dataclass
class FileStructure:
    path: str
    lines: int
    symbols: list[Symbol] = field(default_factory=list)
    error: str | None = None


def clean_signature(value: str) -> str:
    return " ".join(value.strip().split())


def source_lines(text: str) -> list[str]:
    return text.splitlines()


def python_signature(node: ast.FunctionDef | ast.AsyncFunctionDef) -> str:
    prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
    result = f"{prefix} {node.name}{ast.unparse(node.args)}"
    if node.returns is not None:
        result += f" -> {ast.unparse(node.returns)}"
    return result + ":"


def python_docstring(node: ast.AST) -> str | None:
    value = ast.get_docstring(node, clean=False)
    return value if value else None


def parse_python(path: Path, text: str) -> FileStructure:
    result = FileStructure(path.as_posix(), len(source_lines(text)))
    try:
        tree = ast.parse(text, filename=str(path))
    except SyntaxError as error:
        result.error = f"SyntaxError: {error.msg} at line {error.lineno}"
        return result

    def visit(body: Iterable[ast.stmt], parents: tuple[str, ...]) -> None:
        for node in body:
            if isinstance(node, ast.ClassDef):
                qualified_name = ".".join((*parents, node.name))
                result.symbols.append(
                    Symbol(
                        "class",
                        node.name,
                        qualified_name,
                        f"class {node.name}",
                        node.lineno,
                        getattr(node, "end_lineno", node.lineno),
                        python_docstring(node),
                    )
                )
                visit(node.body, (*parents, node.name))
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                qualified_name = ".".join((*parents, node.name))
                kind = "method" if parents else "function"
                result.symbols.append(
                    Symbol(
                        kind,
                        node.name,
                        qualified_name,
                        python_signature(node),
                        node.lineno,
                        getattr(node, "end_lineno", node.lineno),
                        python_docstring(node),
                    )
                )
                visit(node.body, (*parents, node.name))
            elif isinstance(node, (ast.If, ast.For, ast.AsyncFor, ast.While, ast.With, ast.AsyncWith, ast.Try, ast.Match)):
                nested: list[ast.stmt] = []
                for attribute in ("body", "orelse", "finalbody", "handlers", "cases"):
                    value = getattr(node, attribute, [])
                    if attribute == "handlers":
                        for handler in value:
                            nested.extend(handler.body)
                    elif attribute == "cases":
                        for case in value:
                            nested.extend(case.body)
                    else:
                        nested.extend(value)
                visit(nested, parents)

    visit(tree.body, ())
    return result


def mask_typescript(text: str) -> str:
    output = list(text)
    index = 0
    state = "normal"
    while index < len(text):
        char = text[index]
        next_char = text[index + 1] if index + 1 < len(text) else ""
        if state == "normal":
            if char == "/" and next_char == "/":
                output[index] = " "
                output[index + 1] = " "
                index += 2
                state = "line_comment"
                continue
            if char == "/" and next_char == "*":
                output[index] = " "
                output[index + 1] = " "
                index += 2
                state = "block_comment"
                continue
            if char in "'\"`":
                output[index] = " "
                state = char
            index += 1
            continue
        if state == "line_comment":
            if char == "\n":
                state = "normal"
            else:
                output[index] = " "
            index += 1
            continue
        if state == "block_comment":
            if char == "*" and next_char == "/":
                output[index] = " "
                output[index + 1] = " "
                index += 2
                state = "normal"
            else:
                if char != "\n":
                    output[index] = " "
                index += 1
            continue
        if char == "\\":
            output[index] = " "
            if index + 1 < len(text) and text[index + 1] != "\n":
                output[index + 1] = " "
                index += 2
            else:
                index += 1
            continue
        if char == state:
            output[index] = " "
            state = "normal"
        elif char != "\n":
            output[index] = " "
        index += 1
    return "".join(output)


def matching_brace(masked: str, opening: int) -> int:
    if opening < 0 or opening >= len(masked) or masked[opening] != "{":
        return opening
    depth = 0
    for index in range(opening, len(masked)):
        if masked[index] == "{":
            depth += 1
        elif masked[index] == "}":
            depth -= 1
            if depth == 0:
                return index
    return len(masked) - 1


def brace_depth(masked: str, index: int) -> int:
    return masked.count("{", 0, index) - masked.count("}", 0, index)


def body_range(masked: str, signature_end: int) -> tuple[int, int]:
    body_start = signature_end
    while body_start < len(masked) and masked[body_start].isspace():
        body_start += 1
    if body_start < len(masked) and masked[body_start] == "{":
        return body_start, matching_brace(masked, body_start)
    body_end = masked.find(";", body_start)
    if body_end < 0:
        body_end = masked.find("\n", body_start)
    return body_start, body_end if body_end >= 0 else signature_end


def line_number(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def jsdoc(lines: list[str], start_line: int) -> str | None:
    index = start_line - 2
    while index >= 0 and not lines[index].strip():
        index -= 1
    if index < 0 or not lines[index].strip().endswith("*/"):
        return None
    end = index
    while index >= 0 and "/*" not in lines[index]:
        index -= 1
    if index < 0:
        return None
    return "\n".join(lines[index : end + 1]).strip()


def typescript_symbol(
    kind: str,
    name: str,
    signature: str,
    start: int,
    end: int,
    lines: list[str],
    parent: str | None = None,
) -> Symbol:
    qualified_name = f"{parent}.{name}" if parent else name
    return Symbol(
        kind=kind,
        name=name,
        qualified_name=qualified_name,
        signature=clean_signature(signature),
        start_line=start,
        end_line=end,
        docstring=jsdoc(lines, start),
    )


def parse_typescript(path: Path, text: str) -> FileStructure:
    lines = source_lines(text)
    masked = mask_typescript(text)
    result = FileStructure(path.as_posix(), len(lines))
    class_ranges: list[tuple[str, int, int, str]] = []

    class_pattern = re.compile(
        r"(?m)^[ \t]*(?:(?:export|default|abstract|declare)[ \t]+)*(class|interface|enum)[ \t]+([A-Za-z_$][\w$]*)[^\n{]*"
    )
    for match in class_pattern.finditer(masked):
        start = line_number(masked, match.start())
        opening = masked.find("{", match.end())
        end_index = matching_brace(masked, opening)
        end = line_number(masked, end_index)
        kind = "class" if match.group(1) == "class" else match.group(1)
        signature = text[match.start() : opening]
        symbol = typescript_symbol(kind, match.group(2), signature, start, end, lines)
        result.symbols.append(symbol)
        class_ranges.append((match.group(2), opening, end_index, kind))

    function_pattern = re.compile(
        r"(?m)^[ \t]*(?:(?:export|default|declare|async)[ \t]+)*(?:async[ \t]+)?function[ \t]*\*?[ \t]*([A-Za-z_$][\w$]*)[ \t]*(?:<[^\n>{}]*>)?[ \t]*\([^\n{}]*\)(?:[ \t]*:[ \t]*[^\n{=]+)?"
    )
    for match in function_pattern.finditer(masked):
        start = line_number(masked, match.start())
        _, body_end = body_range(masked, match.end())
        end = line_number(masked, body_end)
        result.symbols.append(
            typescript_symbol("function", match.group(1), text[match.start() : match.end()], start, end, lines)
        )

    arrow_pattern = re.compile(
        r"(?m)^[ \t]*(?:(?:export|default)[ \t]+)?(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)[ \t]*=[ \t]*(?:async[ \t]+)?(?:\([^\n{}]*\)|[A-Za-z_$][\w$]*)(?:[ \t]*:[ \t]*[^=\n]+)?[ \t]*=>"
    )
    for match in arrow_pattern.finditer(masked):
        start = line_number(masked, match.start())
        _, body_end = body_range(masked, match.end())
        end = line_number(masked, body_end)
        result.symbols.append(
            typescript_symbol("function", match.group(1), text[match.start() : match.end()], start, end, lines)
        )

    method_pattern = re.compile(
        r"(?m)^[ \t]*(?:(?:public|private|protected|static|abstract|readonly|override|async|get|set)[ \t]+)*([A-Za-z_$][\w$]*|constructor)[ \t]*(?:<[^\n>{}]*>)?[ \t]*\([^\n{}]*\)(?:[ \t]*:[ \t]*[^\n{=]+)?"
    )
    for match in method_pattern.finditer(masked):
        start = line_number(masked, match.start())
        parent = next(
            (
                item
                for item in class_ranges
                if item[1] < match.start() < item[2]
                and item[3] == "class"
                and brace_depth(masked[item[1] + 1 : item[2]], match.start() - item[1] - 1) == 0
            ),
            None,
        )
        if parent is None:
            continue
        prefix = masked[max(0, match.start() - 20) : match.start()]
        if re.search(r"\b(?:if|for|while|switch|catch|function)[ \t]*$", prefix):
            continue
        _, body_end = body_range(masked, match.end())
        end = line_number(masked, body_end)
        result.symbols.append(
            typescript_symbol(
                "method",
                match.group(1),
                text[match.start() : match.end()],
                start,
                end,
                lines,
                parent[0],
            )
        )

    result.symbols.sort(key=lambda item: (item.start_line, item.kind != "class", item.qualified_name))
    return result


def parse_markdown(path: Path, text: str) -> FileStructure:
    lines = source_lines(text)
    result = FileStructure(path.as_posix(), len(lines))
    for index, line in enumerate(lines, 1):
        heading = re.match(r"^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$", line)
        item = re.match(r"^\s*[-*+]\s+(.+)$", line)
        if heading:
            result.symbols.append(Symbol("heading", heading.group(2), heading.group(2), line.strip(), index, index))
        elif item:
            value = item.group(1).strip()
            identifier = re.match(r"(?:\*\*)?\[?([A-Za-z]+\d+(?:\.\d+)*)", value)
            name = identifier.group(1) if identifier else value
            result.symbols.append(Symbol("item", name, name, value, index, index))
    return result


def iter_files(root: Path, extensions: set[str], excluded_dirs: set[str]) -> Iterable[Path]:
    if root.is_file():
        yield root
        return
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in extensions:
            continue
        if any(part in excluded_dirs for part in path.parts):
            continue
        yield path


def parse_path(path: Path, root: Path, include_docs: bool) -> FileStructure:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return FileStructure(path.as_posix(), 0, error="file is not valid UTF-8")
    relative = path.relative_to(root).as_posix() if root.is_dir() else path.name
    normalized = Path(relative)
    if normalized.suffix.lower() == ".py":
        result = parse_python(path, text)
    elif normalized.suffix.lower() in SOURCE_EXTENSIONS:
        result = parse_typescript(path, text)
    elif include_docs and normalized.suffix.lower() == ".md":
        result = parse_markdown(path, text)
    else:
        return FileStructure(relative, len(source_lines(text)))
    result.path = relative
    return result


def structure_data(files: list[FileStructure]) -> dict[str, object]:
    return {
        "files": [
            {
                "path": item.path,
                "lines": item.lines,
                "error": item.error,
                "symbols": [asdict(symbol) for symbol in item.symbols],
            }
            for item in files
        ]
    }


def render_docstring(value: str | None, indent: str = "  ") -> str:
    if not value:
        return ""
    return "\n".join(f"{indent}{line}" for line in value.splitlines())


def render_markdown(files: list[FileStructure]) -> str:
    original_lines = sum(item.lines for item in files)
    symbols = sum(len(item.symbols) for item in files)
    output: list[str] = ["# Code structure", "", f"Files: {len(files)}", f"Source lines: {original_lines}", f"Symbols: {symbols}", ""]
    for item in files:
        output.append(f"## `{item.path}` ({item.lines} lines)")
        if item.error:
            output.extend(["", f"- Error: {item.error}"])
        if not item.symbols and not item.error:
            output.extend(["", "- No public structure found"])
        for symbol in item.symbols:
            output.append(
                f"- {symbol.kind} `{symbol.qualified_name}` `L{symbol.start_line}-L{symbol.end_line}`: `{symbol.signature}`"
            )
            if symbol.docstring:
                output.append("  docstring:")
                output.append(render_docstring(symbol.docstring))
        output.append("")
    return "\n".join(output).rstrip() + "\n"


def find_symbols(files: list[FileStructure], query: str) -> list[tuple[FileStructure, Symbol]]:
    matches: list[tuple[FileStructure, Symbol]] = []
    for item in files:
        for symbol in item.symbols:
            if symbol.qualified_name == query or symbol.name == query or query in symbol.qualified_name:
                matches.append((item, symbol))
    return matches


def show_symbol(root: Path, matches: list[tuple[FileStructure, Symbol]]) -> str:
    output: list[str] = []
    for item, symbol in matches:
        path = root / item.path if root.is_dir() else Path(item.path)
        lines = path.read_text(encoding="utf-8").splitlines()
        output.append(f"## `{item.path}:{symbol.start_line}-{symbol.end_line}` {symbol.qualified_name}")
        output.extend(lines[symbol.start_line - 1 : symbol.end_line])
        output.append("")
    return "\n".join(output).rstrip() + ("\n" if output else "")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build a compact source structure index and optionally read one symbol body."
    )
    parser.add_argument("root", nargs="?", default=".", help="file or directory to scan")
    parser.add_argument("--output", "-o", help="write the result to a file")
    parser.add_argument("--format", choices=("markdown", "json"), default="markdown")
    parser.add_argument("--include-docs", action="store_true", help="include CHANGELOG.md, BACKLOG.md and other Markdown files")
    parser.add_argument("--symbol", help="print the exact source range for a symbol instead of its structure")
    parser.add_argument("--exclude", action="append", default=[], help="directory name to exclude; repeatable")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    root = Path(args.root).resolve()
    if not root.exists():
        print(f"Path not found: {root}", file=sys.stderr)
        return 2
    extensions = set(SOURCE_EXTENSIONS)
    if args.include_docs:
        extensions.add(".md")
    files = [parse_path(path, root, args.include_docs) for path in iter_files(root, extensions, DEFAULT_EXCLUDED_DIRS | set(args.exclude))]
    if args.symbol:
        content = show_symbol(root, find_symbols(files, args.symbol))
        if not content:
            print(f"Symbol not found: {args.symbol}", file=sys.stderr)
            return 1
    elif args.format == "json":
        content = json.dumps(structure_data(files), ensure_ascii=False, indent=2) + "\n"
    else:
        content = render_markdown(files)
    if args.output:
        Path(args.output).write_text(content, encoding="utf-8")
    else:
        print(content, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
