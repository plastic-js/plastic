# Repository Instructions for GitHub Copilot

## Coding Standards
- **JavaScript Syntax**: Use modern JavaScript (ECMAScript 2020+) features and syntax.
- **Function Definitions**: Always prefer **arrow functions** (`const myFunc = () => {}`) over traditional `function` declarations.
- **Asynchronous Patterns**: 
    - Prefer using **Promises** with `.then()` and `.catch()` chains rather than `async/await` syntax. 
    - Avoid `await` unless specifically required by the context or a library's constraints.

## Platform Specifics & Environment
- **Package Management**:
    - When providing terminal commands or setup instructions for `npm install` on **macOS**, always prefix the command with `sudo` to ensure Administrator Privileges (e.g., `sudo npm install <package>`).

## Project Context
- Ensure all generated code snippets follow these rules to maintain consistency across the codebase.
