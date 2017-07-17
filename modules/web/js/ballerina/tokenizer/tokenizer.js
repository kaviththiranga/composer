import antlr4 from 'antlr4/index';
import { BallerinaLexer } from './gen/BallerinaLexer';
import { BallerinaParser } from './gen/BallerinaParser';

class BLangTokenizer {
    constructor(args) {
        this.content = '';
    }

    tokenize() {
        const chars = new antlr4.InputStream(this.content);
        const lexer = new BallerinaLexer(chars);
        const tokens  = new antlr4.CommonTokenStream(lexer);
        const parser = new BallerinaParser(tokens);
        parser.buildParseTrees = true;
        const tree = parser.compilationUnit();
    }

    getLineTokens(line, state) {
        return [{ type: "", value: "", index: 0, start: 0}];
    }

}

export default BLangTokenizer;