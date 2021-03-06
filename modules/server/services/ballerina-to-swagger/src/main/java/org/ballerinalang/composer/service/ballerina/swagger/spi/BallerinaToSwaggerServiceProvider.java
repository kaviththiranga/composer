/*
 * Copyright (c) 2018, WSO2 Inc. (http://wso2.com) All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.ballerinalang.composer.service.ballerina.swagger.spi;

import org.ballerinalang.composer.server.core.ServerConfig;
import org.ballerinalang.composer.server.spi.ComposerService;
import org.ballerinalang.composer.server.spi.ComposerServiceProvider;
import org.ballerinalang.composer.server.spi.annotation.ComposerSPIServiceProvider;
import org.ballerinalang.composer.service.ballerina.swagger.service.BallerinaToSwaggerService;

/**
 *  Ballerina To Swagger service provider.
 */
@ComposerSPIServiceProvider
public class BallerinaToSwaggerServiceProvider implements ComposerServiceProvider {
    @Override
    public ComposerService createService(ServerConfig config) {
        return new BallerinaToSwaggerService();
    }
}
