import toruslabsNode from "@toruslabs/eslint-config-node";

export default [
  ...toruslabsNode,
  {
    rules: {
      camelcase: 0,
      "import/no-extraneous-dependencies": ["error", { devDependencies: ["**/*.test.*", "**/*.config.*", "**/test/**"] }],
      "n/no-unpublished-import": "off",
      "mocha/no-setup-in-describe": "off",
    },
  },
];
