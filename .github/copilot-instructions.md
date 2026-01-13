# Repository Instructions for GitHub Copilot

## Coding Standards
- **JavaScript Syntax**: Use modern JavaScript (ECMAScript 2020+) features and syntax.
- **Function Definitions**: Always prefer **arrow functions** (`const myFunc = () => {}`) over traditional `function` declarations.
- **Asynchronous Patterns**: 
    - Prefer using **Promises** with `.then()` and `.catch()` chains rather than `async/await` syntax. 
    - For test case files (e.g., files in `spec/` and `*.spec.mjs`), it is not necessary to follow the above; `async/await` may be used as needed.
    - Avoid `await` unless specifically required by the context or a library's constraints.

## Platform Specifics & Environment
- **Package Management**:
    - When providing terminal commands or setup instructions for `npm install` on **macOS**, always prefix the command with `sudo` to ensure Administrator Privileges (e.g., `sudo npm install <package>`).

## Project Context
- Ensure all generated code snippets follow these rules to maintain consistency across the codebase.

## This Project
- This project is focused on implementing a custom JSX runtime that serves as a web front-end framework. The principles of the framework are similar to Solid.js.
- The runtime does not use a Virtual DOM. Prefer direct DOM creation and fine-grained DOM updates instead of diff-based re-rendering.
- The reactive system is built with `alien-signals`. When implementing or refactoring runtime behavior, prefer signal-based dependency tracking, effects, and precise updates driven by reactive graph changes.
- While developing code for this project, always help me with functionality implementation, bug fixing, and performance optimization by referencing Solid.js and other similar frameworks, especially those that avoid Virtual DOM architectures.
