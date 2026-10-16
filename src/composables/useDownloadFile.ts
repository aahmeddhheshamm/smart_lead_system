export function useDownloadFile() {
  const downloadFile = (response: any, type: string, fileName: string, fileExtenstion: string) => {
    const blob = new Blob([response], { type })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${fileName}.${fileExtenstion}`
    link.click()
  }

  return { downloadFile }
}
