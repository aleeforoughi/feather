// @aleeforoughi/feather-living: the Living Page shell (docs/living.md). One base website; the conversation expands it
// with designed blocks from the same library, then folds them back. The host owns the model and streams events;
// Feather renders them, deterministically, and keeps nothing about the person.
export * from "./core/index"
export { Composer, type ComposerProps } from "./components/composer"
export { LivingTurn, type BlockRenderer, type LivingTurnProps } from "./components/turn"
export { Presence, type PresenceKind, type PresenceProps, type PresenceState } from "./components/presence"
export { LivingPage, useConversation, type AskHandler, type LivingPageProps, type UseConversationOptions } from "./components/living-page"
export { PreparedSceneView, type PreparedSceneViewProps } from "./components/prepared-scene"
