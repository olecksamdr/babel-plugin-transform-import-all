module.exports = function ({ types: t }) {
  function buildImport(imported, source) {
    return (
      t.importDeclaration(
        imported.map(
          name => t.importSpecifier(t.identifier(name), t.identifier(name))
        ),
        t.stringLiteral(source)
      )
    );
  }

  // has import * as
  function hasImportAll(node) {
    return node.specifiers.some(specifier =>
      t.isImportNamespaceSpecifier(specifier)
    );
  }

  function getNamespaceSpecifier(node) {
    return node.specifiers.find(specifier =>
      t.isImportNamespaceSpecifier(specifier)
    );
  }

  return {
    pre() {
      // save reference to the "import * as" declaretion in order to replace it
      this.importDeclaretion = null;

      // In case of import * as R from 'ramda' importedIdentifier will be R
      this.importedIdentifier = null;

      // Set is used because we don't want to add some function several times
      this.importedFunctions = new Set();

      this.libraryName = null;
    },
    visitor: {
      ImportDeclaration: {
        exit(path, state) {
          const { node } = path;
          const { libraryName } = state.opts;

          // We need to have access to library name in post method, so we save it
          this.libraryName = libraryName;


          if (hasImportAll(node) && node.source.value === libraryName) {
            this.importDeclaretion = path;
            this.importedIdentifier = getNamespaceSpecifier(node).local.name;
          }
        },
      },
      MemberExpression: {
        enter(path) {
          if (path.node.object.name === this.importedIdentifier) {
            const propertyName = path.node.property.name;

            this.importedFunctions.add(propertyName);

            // R.foo() -> foo()
            path.replaceWith(t.identifier(propertyName));
          }
        },
      },
    },
    post(state) {
      const { libraryName } = state.opts;

      // Convert import * as R from 'ramda' to import { a, b, c } from 'ramda'
      if (this.importDeclaretion) {
        this.importDeclaretion.replaceWith(
          buildImport(Array.from(this.importedFunctions), this.libraryName)
        );
      }
    },
  };
};
