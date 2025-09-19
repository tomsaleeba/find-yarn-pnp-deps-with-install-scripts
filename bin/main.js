#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

async function processZip(zipFile) {
  try {
    console.error(`\x1b[90mChecking ${path.basename(zipFile)}\x1b[0m`)
    const { stdout: listOutput } = await execAsync(`unzip -l "${zipFile}"`)
    const lines = listOutput.split('\n')
    const packageJsonPath = (() => {
      // assumption: the package.json closest to the root is the "right" one
      let result = null
      let minDepthSeen = Infinity
      for (const currLine of lines) {
        const match = currLine.match(/.+(node_modules.*package\.json)/)
        if (!match) {
          continue
        }
        const filePath = match[1]
        const currDepth = filePath.split('/').length
        if (currDepth < minDepthSeen) {
          minDepthSeen = currDepth
          result = filePath.trim()
        }
      }
      return result
    })()
    if (!packageJsonPath) {
      return
    }
    try {
      const { stdout: packageJsonContentStr } = await execAsync(`unzip -p "${zipFile}" "${packageJsonPath}"`)
      const packageJsonObj = JSON.parse(packageJsonContentStr)
      if (packageJsonObj?.scripts?.preinstall
          || packageJsonObj?.scripts?.install
          || packageJsonObj?.scripts?.postinstall
      ) {
        const name = packageJsonObj.name || zipFile
        console.log(name)
      }
    } catch (err) {
      console.error(`[ERROR] failed to parse ${packageJsonPath} for ${zipFile}`, err)
    }
  } catch (err) {
    console.error(`[ERROR] failed to process ${zipFile}`, err)
  }
}

async function main() {
  try {
    const cacheDir = '.yarn/cache'
    if (!fs.existsSync(cacheDir)) {
      console.error('No .yarn/cache directory found')
      process.exit(1)
    }
    const zipFiles = fs.readdirSync(cacheDir)
      .filter(file => file.endsWith('.zip'))
      .map(file => path.join(cacheDir, file))
    // Process files with basic parallelism using Promise.all with chunks
    const chunkSize = 10
    for (let i = 0; i < zipFiles.length; i += chunkSize) {
      const chunk = zipFiles.slice(i, i + chunkSize)
      await Promise.all(chunk.map(processZip))
    }
  } catch (err) {
    console.error('[Error]', err.message)
    process.exit(1)
  }
}

main()
