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
export { registerPython } from './python';
export { registerGo } from './go';
export { registerRust } from './rust';
export { registerJava } from './java';
export { registerPhp } from './php';
export { registerRuby } from './ruby';
export { registerCsharp } from './csharp';
export { registerCpp } from './cpp';
export { registerBash } from './bash';
export { registerGdscript } from './gdscript';
export {
  createRegexMapper,
  type RegexMapperOptions,
  type RegexSymbolPattern,
  type RegexImportPattern,
} from './regex-mapper';
export { registerRegexLanguages } from './regex-patterns';

// Auto-register built-in languages on import
import { registerTypescript } from './typescript';
import { registerPython } from './python';
import { registerGo } from './go';
import { registerRust } from './rust';
import { registerJava } from './java';
import { registerPhp } from './php';
import { registerRuby } from './ruby';
import { registerCsharp } from './csharp';
import { registerCpp } from './cpp';
import { registerBash } from './bash';
import { registerGdscript } from './gdscript';
import { registerRegexLanguages } from './regex-patterns';

registerTypescript();
registerPython();
registerGo();
registerRust();
registerJava();
registerPhp();
registerRuby();
registerCsharp();
registerCpp();
registerBash();
registerGdscript();
registerRegexLanguages();
