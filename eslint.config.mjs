import toruslabsNode from "@toruslabs/eslint-config-node";

export default [
  ...toruslabsNode,
  {
    rules: {
      camelcase: 0,
      "n/no-unpublished-import": "off",
      "mocha/no-setup-in-describe": "off",
    },
  },
];
