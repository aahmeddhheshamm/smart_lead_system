// Ambient helpers kept for older components; new code imports from '@/types/domain'
type TypeResponseError = Partial<Error> & { message?: string; error?: { code: string; message: string } }
