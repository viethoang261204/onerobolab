/**
 * @robolab/blocks — the block program as data, and its compiler.
 *
 * - `block-types` / `block-registry`: the serializable block graph and the
 *   definition of every block (shape, fields, category).
 * - `block-model` / `block-utils`: immutable editing operations.
 * - `block-validation` / `serialization`: structure checks and the stored
 *   JSON form (`roboverse.blocks` v1).
 * - `compiler`: blocks → the shared IR (`@robolab/shared` Program).
 *
 * Pure TypeScript (no DOM, no React, no randomness): the editor in the web
 * app and the API's run judge use the same code, so a program compiles the
 * same way in both places.
 */
export * from './block-types.ts';
export * from './block-registry.ts';
export * from './block-model.ts';
export * from './block-utils.ts';
export * from './block-validation.ts';
export * from './serialization.ts';
export * from './sample-program.ts';
export * from './compiler.ts';
export * from './compiler-errors.ts';
export * from './expression-compiler.ts';
export type * from './command-types.ts';
