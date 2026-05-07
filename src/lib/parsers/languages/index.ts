export {
  registerLanguage,
  registerRegexLanguage,
  isLanguageSupported,
  isRegexLanguageSupported,
  parseSource,
  getMapper,
  getRegexMapper,
  listLanguages,
  listRegexLanguages,
  initParser,
} from './registry';
export type {
  LanguageMapper,
  RegexLanguageMapper,
  ExtractedSymbol,
  ExtractedEdge,
  ExtractedImport,
} from './types';
export { registerTypescript } from './typescript';
export {
  createRegexMapper,
  type RegexMapperOptions,
  type RegexSymbolPattern,
  type RegexImportPattern,
} from './regex-mapper';
export { registerRegexLanguages } from './regex-patterns';

// Auto-register built-in languages on import
import { registerTypescript } from './typescript';
import { registerRegexLanguages } from './regex-patterns';
registerTypescript();
registerRegexLanguages();
