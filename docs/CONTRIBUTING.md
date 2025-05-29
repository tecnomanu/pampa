# Contributing to PAMPA

Thank you for your interest in contributing to PAMPA! We welcome contributions from the community and are excited to see what you'll bring to the project.

## 🚀 Getting Started

### Prerequisites

-   Node.js 18+
-   npm or yarn
-   Git

### Development Setup

1. **Fork and clone the repository**

    ```bash
    git clone https://github.com/your-username/pampa.git
    cd pampa
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Run tests to ensure everything works**

    ```bash
    npm test
    ```

4. **Index the example project for testing**
    ```bash
    npx pampa index example/
    ```

## 📝 How to Contribute

### Reporting Issues

Before creating an issue, please:

1. **Search existing issues** to avoid duplicates
2. **Use the issue template** if available
3. **Provide clear reproduction steps**
4. **Include system information** (OS, Node.js version, etc.)

### Submitting Changes

1. **Create a feature branch**

    ```bash
    git checkout -b feat/your-feature-name
    # or
    git checkout -b fix/your-bug-fix
    ```

2. **Make your changes**

    - Follow the coding standards below
    - Add tests for new functionality
    - Update documentation if needed

3. **Test your changes**

    ```bash
    npm test
    npm run test:mcp
    ```

4. **Commit with conventional format**

    ```bash
    git commit -m "feat: ✨ add new embedding provider"
    git commit -m "fix: 🐛 resolve undefined parameter validation"
    git commit -m "docs: 📚 update README with new examples"
    ```

5. **Push and create a Pull Request**
    ```bash
    git push origin feat/your-feature-name
    ```

## 🎯 Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) with emojis:

| Type       | Emoji | Description              |
| ---------- | ----- | ------------------------ |
| `feat`     | ✨    | New feature              |
| `fix`      | 🐛    | Bug fix                  |
| `docs`     | 📚    | Documentation changes    |
| `refactor` | ♻️    | Code refactoring         |
| `test`     | 🧪    | Adding or updating tests |
| `chore`    | 🔧    | Maintenance tasks        |
| `perf`     | ⚡    | Performance improvements |
| `style`    | 💄    | Code style changes       |

**Examples:**

-   `feat: ✨ add support for Python language parsing`
-   `fix: 🐛 resolve MCP server disconnection on empty queries`
-   `docs: 📚 add installation guide for Windows`

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:mcp
npm run test:diagnostics
```

### Writing Tests

-   Add tests for new features in the `test/` directory
-   Follow the existing test patterns
-   Ensure tests are deterministic and don't depend on external services
-   Mock external dependencies when necessary

### Test Structure

```javascript
// test/test-your-feature.js
#!/usr/bin/env node

import { spawn } from 'child_process';

const testCases = [
    {
        name: "Valid input",
        input: { /* test data */ },
        shouldPass: true
    },
    // ... more test cases
];

async function testYourFeature() {
    console.log('🧪 Testing your feature...\n');

    for (const testCase of testCases) {
        // Test implementation
    }
}

if (process.argv[1] && process.argv[1].endsWith('test-your-feature.js')) {
    testYourFeature().catch(console.error);
}
```

## 🏗️ Code Standards

### JavaScript/Node.js

-   Use ES modules (`import`/`export`)
-   Use async/await for asynchronous operations
-   Follow camelCase for variables and functions
-   Use PascalCase for classes
-   Add JSDoc comments for public APIs

### File Organization

```
pampa/
├── src/                    # Source code (future)
├── test/                   # Test files
├── docs/                   # Documentation
├── examples/               # Example projects
├── indexer.js             # Core indexing logic
├── mcp-server.js          # MCP server implementation
└── package.json
```

### Error Handling

-   Always handle errors gracefully
-   Use the ErrorLogger class for consistent logging
-   Provide helpful error messages to users
-   Don't expose internal errors to MCP clients

### MCP Compatibility

-   All JSON responses must be valid (no emojis in JSON)
-   Validate all input parameters
-   Use `.trim()` on string inputs
-   Handle `undefined` parameters gracefully

## 🌍 Adding Language Support

To add support for a new programming language:

1. **Install the tree-sitter grammar**

    ```bash
    npm install tree-sitter-python
    ```

2. **Add to LANG_RULES in indexer.js**

    ```javascript
    const LANG_RULES = {
    	// ... existing rules
    	'.py': {
    		lang: 'python',
    		ts: LangPython,
    		nodeTypes: ['function_definition', 'class_definition'],
    	},
    };
    ```

3. **Test with Python files**

    ```bash
    npx pampa index path/to/python/project
    ```

4. **Add tests for the new language**

## 🔧 Adding Embedding Providers

To add a new embedding provider:

1. **Create a provider class**

    ```javascript
    class YourProvider extends EmbeddingProvider {
    	async generateEmbedding(text) {
    		// Implementation
    	}

    	getDimensions() {
    		return 768; // Your model dimensions
    	}

    	getName() {
    		return 'YourProvider';
    	}
    }
    ```

2. **Add to the factory function**

    ```javascript
    function createEmbeddingProvider(providerName) {
    	switch (providerName.toLowerCase()) {
    		// ... existing cases
    		case 'yourprovider':
    			return new YourProvider();
    	}
    }
    ```

3. **Update documentation**

## 📚 Documentation

-   Update README.md for user-facing changes
-   Add JSDoc comments for new APIs
-   Update CHANGELOG.md following the format
-   Include examples for new features

## 🤝 Community Guidelines

-   Be respectful and inclusive
-   Help others learn and grow
-   Share knowledge and best practices
-   Follow our [Code of Conduct](CODE_OF_CONDUCT.md)

## 🎉 Recognition

Contributors will be recognized in:

-   README.md contributors section
-   Release notes for significant contributions
-   GitHub contributors page

## ❓ Questions?

-   **General questions**: Open a GitHub Discussion
-   **Bug reports**: Create an Issue
-   **Feature requests**: Create an Issue with the "enhancement" label
-   **Security issues**: Email the maintainers privately

## 📄 License

By contributing to PAMPA, you agree that your contributions will be licensed under the ISC License.

---

Thank you for contributing to PAMPA! 🇦🇷
