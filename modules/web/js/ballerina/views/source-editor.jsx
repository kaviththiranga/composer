/**
 * Copyright (c) 2017, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import 'brace';
import 'brace/ext/language_tools';
import 'brace/ext/searchbox';
import React from 'react';
import PropTypes from 'prop-types';
import log from 'log';
import _ from 'lodash';
import debuggerHoc from 'src/plugins/debugger/views/DebuggerHoc';
import File from './../../../src/core/workspace/model/file';
import SourceViewCompleterFactory from './../../ballerina/utils/source-view-completer-factory';
import { getLangServerClientInstance } from './../../langserver/lang-server-client-controller';
import { CHANGE_EVT_TYPES, WORKER_MESSAGE_TYPES } from './constants';
import { CONTENT_MODIFIED } from './../../constants/events';
import { GO_TO_POSITION } from './../../constants/commands';


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

// ace look & feel configurations FIXME: Make this overridable from settings
const aceTheme = 'ace/theme/twilight';
const fontSize = '14px';
const scrollMargin = 20;

// override default undo manager of ace editor
class NotifyingUndoManager extends AceUndoManager {
    constructor(sourceView) {
        super();
        this.sourceView = sourceView;
    }
    execute(args) {
        super.execute(args);
        this.sourceView.validate();
        if (!this.sourceView.skipFileUpdate) {
            const changeEvent = {
                type: CHANGE_EVT_TYPES.SOURCE_MODIFIED,
                title: 'Modify source',
            };
            const content = this.sourceView.editor.session.getValue();
            this.sourceView.props.file
                .setContent(content, changeEvent);
        }
        this.sourceView.skipFileUpdate = false;
    }
}

class SourceEditor extends React.Component {

    constructor(props) {
        super(props);
        this.container = undefined;
        this.editor = undefined;
        this.inSilentMode = false;
        this.sourceViewCompleterFactory = new SourceViewCompleterFactory();
        this.goToCursorPosition = this.goToCursorPosition.bind(this);
        this.onFileContentChanged = this.onFileContentChanged.bind(this);
        this.lastUpdatedTimestamp = props.file.lastUpdated;
        this.validationWorker = new Worker('dist/validation-worker.js');
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
            editor.getSession().setValue(this.props.file.content);
            editor.setShowPrintMargin(false);
            // Avoiding ace warning
            editor.$blockScrolling = Infinity;
            editor.setTheme(aceTheme);
            editor.setFontSize(fontSize);
            editor.setOptions({
                enableBasicAutocompletion: true,
            });
            editor.setBehavioursEnabled(true);
            // bind auto complete to key press
            editor.commands.on('afterExec', (e) => {
                if (e.command.name === 'insertstring' && /^[\w.@:]$/.test(e.args)) {
                    setTimeout(() => {
                        try {
                            editor.execCommand('startAutocomplete');
                        } finally {
                            // nothing
                        }
                    }, 10);
                }
            });
            editor.renderer.setScrollMargin(scrollMargin, scrollMargin);
            this.editor = editor;
            // bind app keyboard shortcuts to ace editor
            this.props.commandProxy.getCommands().forEach((command) => {
                this.bindCommand(command);
            });
             // register handler for go to position command
            this.props.commandProxy.on(GO_TO_POSITION, this.handleGoToPosition, this);
            // listen to changes done to file content
            // by other means (eg: design-view changes or redo/undo actions)
            // and update ace content accordingly
            this.props.file.on(CONTENT_MODIFIED, this.onFileContentChanged);

            editor.on('guttermousedown', (e) => {
                const target = e.domEvent.target;
                if (target.className.indexOf('ace_gutter-cell') === -1) {
                    return;
                }
                if (!editor.isFocused()) {
                    return;
                }

                const row = e.getDocumentPosition().row;
                const breakpoints = e.editor.session.getBreakpoints(row, 0);
                if (!breakpoints[row]) {
                    this.props.addBreakpoint(row + 1);
                    e.editor.session.setBreakpoint(row);
                } else {
                    this.props.removeBreakpoint(row + 1);
                    e.editor.session.clearBreakpoint(row);
                }
            });
            // on editor annotation change
            // check whether the new set of annoations contain
            // lint errors from background worker
            // this is to re-use ace's in-built worker validations
            // to update design-view btn with #of syntax errors
            editor.getSession().on('changeAnnotation', () => {
                const annotations = editor.getSession().getAnnotations();
                const errors = annotations.filter((annotation) => {
                    // ignore semantic errors & other annotations
                    return annotation.type === 'error' && annotation.category === 'SYNTAX';
                });
                this.props.onLintErrors(errors);
            });
            this.validationWorker.onmessage = (evt) => {
                const { data: { type, args: { errors } } } = evt;
                if (type === WORKER_MESSAGE_TYPES.VALIDATION_RESPONSE) {
                    if (!_.isNil(errors) && _.isArray(errors)) {
                        errors.forEach((syntaxError) => {
                            // ace's rows start from zero, but parser begins from 1
                            syntaxError.row -= 1;
                        });
                        editor.getSession().setAnnotations(errors);
                    } else {
                        // no new errors or something wrong with validator. clear up current errors
                        editor.getSession().clearAnnotations();
                    }
                }
            };
            this.validationWorker.onerror = (error) => {
                log.error('Error while validating content', error);
                editor.getSession().clearAnnotations();
            };
            this.validate();
        }
    }

    /**
     * Event handler when the content of the file object is changed.
     * @param {Object} evt The event object.
     * @memberof SourceEditor
     */
    onFileContentChanged(evt) {
        if (evt.originEvt.type !== CHANGE_EVT_TYPES.SOURCE_MODIFIED) {
            // no need to update the file again, hence
            // the second arg to skip update event
            this.replaceContent(evt.newContent, true);
        }
    }

    /**
     * Go to given position command handler.
     *
     * @param {Object} args
     * @param {File} args.file File
     * @param {number} args.row Line number
     * @param {number} args.column Offset
     */
    handleGoToPosition(args) {
        if (this.props.file.id === args.file.id) {
            this.goToCursorPosition(args.row, args.column);
        }
    }

    /**
     * Validate in background
     */
    validate() {
        const { file: { name, extension, path } } = this.props;
        const content = this.editor.session.getValue();
        this.validationWorker.postMessage({
            type: WORKER_MESSAGE_TYPES.VALIDATION_REQUEST,
            args: {
                fileName: name + '.' + extension,
                filePath: path,
                content,
            },
        });
    }

    /**
     * Set cursor of the source editor to a
     * specific position.
     *
     * @param {number} row Line Number
     * @param {number} column Offset
     */
    goToCursorPosition(row, column) {
        this.editor.focus();
        this.editor.gotoLine(row + 1, column);
    }

    /**
     * Replace content of the editor while maintaining history
     *
     * @param {*} newContent content to insert
     */
    replaceContent(newContent, skipFileUpdate) {
        if (skipFileUpdate) {
            this.skipFileUpdate = true;
        }
        const session = this.editor.getSession();
        const contentRange = new Range(0, 0, session.getLength(),
                        session.getRowLength(session.getLength()));
        session.replace(contentRange, newContent);
        this.lastUpdatedTimestamp = this.props.file.lastUpdated;
    }

    shouldComponentUpdate() {
        // update ace editor - https://github.com/ajaxorg/ace/issues/1245
        this.editor.resize(true);
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
        const { id, argTypes, shortcut } = command;
        const { dispatch } = this.props.commandProxy;
        if (shortcut) {
            const shortcutKey = _.replace(shortcut.derived.key, '+', '-');
            this.editor.commands.addCommand({
                name: id,
                bindKey: { win: shortcutKey, mac: shortcutKey },
                exec() {
                    dispatch(id, argTypes);
                },
            });
        }
    }

    render() {
        return (
            <div className='text-editor bal-source-editor' ref={(ref) => { this.container = ref; }} />
        );
    }

    /**
     * lifecycle hook for component will receive props
     */
    componentWillReceiveProps(nextProps) {
        if (!nextProps.parseFailed) {
            getLangServerClientInstance()
                .then((langserverClient) => {
                    // Set source view completer
                    const sourceViewCompleterFactory = this.sourceViewCompleterFactory;
                    const fileData = { fileName: nextProps.file.name,
                        filePath: nextProps.file.path,
                        packageName: nextProps.file.packageName };
                    const completer = sourceViewCompleterFactory.getSourceViewCompleter(langserverClient, fileData);
                    langTools.setCompleters(completer);
                })
                .catch(error => log.error(error));
        }

        const { debugHit, sourceViewBreakpoints } = nextProps;
        if (this.debugPointMarker) {
            this.editor.getSession().removeMarker(this.debugPointMarker);
        }
        if (debugHit > 0) {
            this.debugPointMarker = this.editor.getSession().addMarker(
                new Range(debugHit, 0, debugHit, 2000), 'debug-point-hit', 'line', true);
        }

        if (this.props.file.id !== nextProps.file.id) {
            // Removing the file content changed event of the previous file.
            this.props.file.off(CONTENT_MODIFIED, this.onFileContentChanged);
            // Adding the file content changed event to the new file.
            nextProps.file.on(CONTENT_MODIFIED, this.onFileContentChanged);
            this.replaceContent(nextProps.file.content, true);
        } else if (this.editor.session.getValue() !== nextProps.file.content) {
            this.replaceContent(nextProps.file.content, true);
        }

        this.editor.getSession().setBreakpoints(sourceViewBreakpoints);
    }
}

SourceEditor.propTypes = {
    file: PropTypes.instanceOf(File).isRequired,
    commandProxy: PropTypes.shape({
        on: PropTypes.func.isRequired,
        dispatch: PropTypes.func.isRequired,
        getCommands: PropTypes.func.isRequired,
    }).isRequired,
    parseFailed: PropTypes.bool.isRequired,
    onLintErrors: PropTypes.func,
    sourceViewBreakpoints: PropTypes.arrayOf(Number).isRequired,
    addBreakpoint: PropTypes.func.isRequired,
    removeBreakpoint: PropTypes.func.isRequired,
    debugHit: PropTypes.number,
};

SourceEditor.defaultProps = {
    debugHit: null,
    onLintErrors: () => {},
};

export default debuggerHoc(SourceEditor);
