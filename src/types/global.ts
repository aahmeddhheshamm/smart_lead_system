import "pinia"
import type { Router } from "vue-router"

export type TypeResponseError = Partial<Error> & {
    message?: string
    error?: { code: string; message: string; details?: any; requestId?: string }
}

declare module "pinia" {
    export interface PiniaCustomProperties {
        $router: Router
    }
}
