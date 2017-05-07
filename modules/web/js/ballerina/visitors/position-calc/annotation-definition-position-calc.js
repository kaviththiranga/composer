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

import log from 'log';
import _ from 'lodash';
import * as DesignerDefaults from './../../configs/designer-defaults';
import ASTFactory from './../../ast/ballerina-ast-factory';
import {panel} from './../../configs/designer-defaults';

class AnnotationDefinitionPositionCalcVisitor {
    /**
     * Check whether annotation definition position calc visitor can be visited.
     * @param {object} node.
     * @return {boolean}
     * */
    canVisit(node) {
        return true;
    }

    beginVisit(node) {
        let viewState = node.getViewState();
        let bBox = viewState.bBox;
        let parent = node.getParent();
        let panelChildren = parent.filterChildren(function (child) {
            return ASTFactory.isFunctionDefinition(child) || ASTFactory.isServiceDefinition(child)
                || ASTFactory.isConnectorDefinition(child) || ASTFactory.isAnnotationDefinition(child);
        });

        let heading = viewState.components.heading;
        let body = viewState.components.body;
        let currentServiceIndex = _.findIndex(panelChildren, node);
        let x, y, headerX, headerY, bodyX, bodyY;
        if (currentServiceIndex === 0) {
            headerX = DesignerDefaults.panel.wrapper.gutter.h;
            headerY = DesignerDefaults.panel.wrapper.gutter.v;
        } else if (currentServiceIndex > 0) {
            let previousServiceBBox = panelChildren[currentServiceIndex - 1].getViewState().bBox;
            headerY = previousServiceBBox.y + previousServiceBBox.h + DesignerDefaults.panel.wrapper.gutter.v;
            headerX = DesignerDefaults.panel.wrapper.gutter.h;
        } else {
            throw 'Invalid Index for Annotation Definition';
        }

        x = headerX;
        y = headerY;
        bodyX = headerX;
        bodyY = headerY + heading.h;

        bBox.x = x;
        bBox.y = y;
        heading.x = headerX;
        heading.y = headerY;
        body.x = bodyX;
        body.y = bodyY;

        let children = node.getChildren();
        let minWidth = node.getViewState().bBox.w - ( panel.body.padding.left + panel.body.padding.right);
    }

    visit(node) {
        log.debug('visit AnnotationPositionCalc');
    }

    endVisit(node) {
        log.debug('end visit AnnotationPositionCalc');
    }
}

export default AnnotationDefinitionPositionCalcVisitor;