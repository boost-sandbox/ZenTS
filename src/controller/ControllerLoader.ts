import { Controllers, HTTPMethod, REFLECT_METADATA, Route } from '../types/'

import { AbstractZenFileLoader } from '../filesystem/AbstractZenFileLoader'
import type { Class } from 'type-fest'
import { fs } from '../filesystem/FS'
import { log } from '../log/logger'

export class ControllerLoader extends AbstractZenFileLoader {
  protected controllers: Controllers = new Map() as Controllers

  public async load(): Promise<Controllers> {
    const filePaths = (
      await fs.readDirContentRecursive(fs.resolveZenPath('controller'))
    ).filter((filePath: string) =>
      filePath.toLowerCase().endsWith(fs.resolveZenFileExtension('controller')),
    )

    for (const filePath of filePaths) {
      const { key, module } = await this.loadModule(filePath)
      const keyMetadata = Reflect.getMetadata(REFLECT_METADATA.CONTROLLER_KEY, module) as
        | string
        | undefined
      const controllerKey =
        typeof keyMetadata !== 'string' ? key : `${keyMetadata}Controller`.toLowerCase()

      if (this.controllers.has(controllerKey)) {
        log.warn(`Controller with key "${controllerKey}" is already registered!`)

        continue
      }

      this.controllers.set(controllerKey, {
        module,
        routes: this.loadControllerRoutes(module),
      })
    }

    return this.controllers
  }

  protected loadControllerRoutes(classModule: Class): Route[] {
    const routes: Route[] = []
    const methods = this.getClassMethods(classModule.prototype)
    let prefix = Reflect.getMetadata(REFLECT_METADATA.URL_PREFIX, classModule) as string

    if (!prefix) {
      prefix = ''
    } else if (prefix.endsWith('/')) {
      prefix = prefix.slice(0, -1)
    }

    for (const method of methods) {
      if (method === 'constructor') {
        continue
      }

      const httpMethod = Reflect.getMetadata(
        REFLECT_METADATA.HTTP_METHOD,
        classModule.prototype,
        method,
      ) as HTTPMethod

      if (httpMethod) {
        let urlPath = Reflect.getMetadata(
          REFLECT_METADATA.URL_PATH,
          classModule.prototype,
          method,
        ) as string

        if (prefix.length && !urlPath.startsWith('/')) {
          urlPath = `/${urlPath}`
        }

        routes.push({
          method: httpMethod.toUpperCase() as HTTPMethod,
          path: `${prefix}${urlPath}`,
          controllerMethod: method,
        })
      }
    }

    return routes
  }
}
