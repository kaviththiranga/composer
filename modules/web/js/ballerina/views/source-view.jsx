import React from 'react';
import PropTypes from 'prop-types';
import log from 'log';
import _ from 'lodash';
import commandManager from 'command';
import File from './../../workspace/file';
import SourceGenVisitor from './../visitors/source-gen/ballerina-ast-root-visitor';
import EnableDefaultWSVisitor from './../visitors/source-gen/enable-default-ws-visitor';
import SourceViewCompleterFactory from './../../ballerina/utils/source-view-completer-factory';
import { getLangServerClientInstance } from './../../langserver/lang-server-client-controller';
import 'brace';
import 'brace/ext/language_tools';
import 'brace/ext/searchbox';

const ace = global.ace;
const Range = ace.acequire('ace/range').Range;
const AceUndoManager = ace.acequire('ace/undomanager').UndoManager;

// require ballerina mode
const langTools = ace.acequire('ace/ext/language_tools');

const ballerinaMode = 'ace/mode/ballerina';
// load ballerina mode
ace.acequire(ballerinaMode);

// require possible themes
function requireAll(requireContext) {
    return requireContext.keys().map(requireContext);
}
requireAll(require.context('ace', false, /theme-/));

// ace look & feel configurations
let aceTheme = 'ace/theme/twilight';
let fontSize = '14px';
let scrollMargin = 20;

// override default undo manager of ace editor
class NotifyingUndoManager extends AceUndoManager {
    constructor(sourceView) {
        super();
        this.sourceView = sourceView;
    }
    execute(args) {
        super.execute(args);
        if (!this.sourceView.inSilentMode) {
            let changeEvent = {
                type: 'source-modified',
                title: 'Modify source'
            };
        }
        this.sourceView.inSilentMode = false;
    }
}

class SourceView extends React.Component {

    constructor (props) {
        super (props);
        this.container = undefined;
        this.editor = undefined;
        this.inSilentMode = false;
    }

    /**
     * lifecycle hook for component did mount
     */
    componentDidMount() {
        if (!_.isNil(this.container)) {
            // initialize ace editor
            const editor = ace.edit(this.container);
            editor.getSession().setMode(ballerinaMode);
            editor.getSession().setUndoManager(new NotifyingUndoManager(this));
            editor.getSession().setValue(this.props.file.getContent());
            editor.setShowPrintMargin(false);
            // Avoiding ace warning
            editor.$blockScrolling = Infinity;
            editor.setTheme(aceTheme);
            editor.setFontSize(fontSize);
            editor.setOptions({
                enableBasicAutocompletion: true,
            });
            editor.setBehavioursEnabled(true);
            editor.renderer.setScrollMargin(scrollMargin, scrollMargin);
            getLangServerClientInstance()
                .then((langserverClient) => {
                    const completer = SourceViewCompleterFactory.getSourceViewCompleter(langserverClient);
                    langTools.addCompleter(completer);
                })
                .catch(log.error);
            this.editor = editor;
            // bind app keyboard shortcuts to ace editor
            this.props.commandManager.getCommands().forEach((command) => {
                this.bindCommand(command);
            });
        }
    }   

    shouldComponentUpdate () {
        // keep this component unaffected from react re-render
        return false;
    }

    /**
     * Binds a shortcut to ace editor so that it will trigger the command on source view upon key press.
     * All the commands registered app's command manager will be bound to source view upon render.
     *
     * @param command {Object}
     * @param command.id {String} Id of the command to dispatch
     * @param command.shortcuts {Object}
     * @param command.shortcuts.mac {Object}
     * @param command.shortcuts.mac.key {String} key combination for mac platform eg. 'Command+N'
     * @param command.shortcuts.other {Object}
     * @param command.shortcuts.other.key {String} key combination for other platforms eg. 'Ctrl+N'
     */
    bindCommand(command) {
        let id = command.id;
        let hasShortcut = _.has(command, 'shortcuts');
        let self = this;
        if (hasShortcut) {
            let macShortcut = _.replace(command.shortcuts.mac.key, '+', '-');
            let winShortcut = _.replace(command.shortcuts.other.key, '+', '-');
            this.editor.commands.addCommand({
                name: id,
                bindKey: { win: winShortcut, mac: macShortcut },
                exec() {
                    self.props.commandManager.dispatch(id);
                }
            });
        }
    }

    render() {
        return (
            <div className="source-view-container" >
                <div className='text-editor' ref={ (ref) => { this.container = ref } }/>
                <div className="bottom-right-controls-container">
                    <div className="view-design-btn btn-icon">
                        <div className="bottom-label-icon-wrapper">
                            <i className="fw fw-design-view fw-inverse" />
                        </div>
                        <div className="bottom-view-label" 
                                onClick={
                                    () => {
                                        this.context.editor.setActiveView('DESIGN_VIEW');
                                    }
                                }
                        >
                            Design View
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

SourceView.propTypes = {
    file: PropTypes.instanceOf(File).isRequired,
    commandManager: PropTypes.instanceOf(commandManager).isRequired
};

SourceView.contextTypes = {
    editor: PropTypes.instanceOf(Object).isRequired,
};

export default SourceView;