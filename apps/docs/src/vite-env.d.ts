/// <reference types="vite/client" />

declare module "virtual:docs" {
  const data: import("../plugins/docs-source").DocsData
  export default data
}
