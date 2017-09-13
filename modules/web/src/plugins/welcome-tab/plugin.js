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

import Plugin from 'core/plugin/plugin';
import { CONTRIBUTIONS } from 'core/plugin/constants';
import { REGIONS } from 'core/layout/constants';
import { COMMANDS as WORKSPACE_COMMANDS } from 'core/workspace/constants';
/** Plugin imports */
import WelcomeTab from './views/welcome-tab';
import { LABELS, VIEWS as WELCOME_TAB_VIEWS, WELCOME_TAB_PLUGIN_ID } from './constants';

/**
 * Plugin for Welcome tab.
 */
class WelcomeTabPlugin extends Plugin {

    /**
     * @inheritdoc
     */
    getID() {
        return WELCOME_TAB_PLUGIN_ID;
    }

    createNewHandler() {
        console.log(this);
    }

    openFileHandler() {
        const { command } = this.appContext;
        command.dispatch(WORKSPACE_COMMANDS.SHOW_FILE_OPEN_WIZARD, '');
    }

    openDirectoryHandler() {
        const { command } = this.appContext;
        command.dispatch(WORKSPACE_COMMANDS.SHOW_FOLDER_OPEN_WIZARD, '');
    }

    /**
     * @inheritdoc
     */
    getContributions() {
        const { VIEWS } = CONTRIBUTIONS;
        return {
            [VIEWS]: [
                {
                    id: WELCOME_TAB_VIEWS.WELCOME_TAB_VIEW_ID,
                    component: WelcomeTab,
                    propsProvider: () => {
                        const { command } = this.appContext;
                        return {
                            createNew: this.createNewHandler.bind(this),
                            openFile: this.openFileHandler.bind(this),
                            openDirectory: this.openDirectoryHandler.bind(this),
                            userGuide: this.config.userGuide,
                            balHome: this.config.balHome,
                            samples: this.config.samples,
                            commandManager: command,
                        };
                    },
                    region: REGIONS.EDITOR_TABS,
                    // region specific options for editor-tabs views
                    regionOptions: {
                        tabTitle: LABELS.WELCOME,
                        customTitleClass: 'welcome-page-tab-title',
                    },
                },
            ],
        };
    }

}

export default WelcomeTabPlugin;