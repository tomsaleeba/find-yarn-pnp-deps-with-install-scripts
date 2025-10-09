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
      if (hasInstallScripts(packageJsonObj)) {
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

function hasInstallScripts(packageJsonObj) {
  return packageJsonObj?.scripts?.preinstall
      || packageJsonObj?.scripts?.install
      || packageJsonObj?.scripts?.postinstall
}

function* findPackageJsonFiles(dir, depth = 0, maxDepth = 20) {
  // Prevent infinite recursion
  if (depth > maxDepth) {
    return
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      // Skip symlinks to avoid infinite loops
      if (entry.isSymbolicLink()) {
        continue
      }

      if (entry.isDirectory()) {
        // If this is a package directory (has package.json), yield it
        const packageJsonPath = path.join(fullPath, 'package.json')
        if (fs.existsSync(packageJsonPath)) {
          yield packageJsonPath
        }

        // Recurse into node_modules subdirectories
        if (entry.name === 'node_modules') {
          yield* findPackageJsonFiles(fullPath, depth + 1, maxDepth)
        }
      }
    }
  } catch (err) {
    // Skip directories we can't read
    console.error(`[WARN] Could not read directory ${dir}`, err.message)
  }
}

async function processNodeModulesPackage(packageJsonPath) {
  try {
    const packageDir = path.dirname(packageJsonPath)
    const relativePath = path.relative('node_modules', packageDir)
    console.error(`\x1b[90mChecking ${relativePath}\x1b[0m`)

    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8')
    const packageJsonObj = JSON.parse(packageJsonContent)

    if (hasInstallScripts(packageJsonObj)) {
      const name = packageJsonObj.name || relativePath
      console.log(name)
    }
  } catch (err) {
    console.error(`[ERROR] failed to process ${packageJsonPath}`, err.message)
  }
}

async function main() {
  try {
    const yarnCacheDir = '.yarn/cache'
    const nodeModulesDir = 'node_modules'
    const hasYarnCache = fs.existsSync(yarnCacheDir)
    const hasNodeModules = fs.existsSync(nodeModulesDir)
    if (hasYarnCache) {
      console.error('\x1b[36mScanning Yarn PnP cache...\x1b[0m')
      const zipFiles = fs.readdirSync(yarnCacheDir)
        .filter(file => file.endsWith('.zip'))
        .map(file => path.join(yarnCacheDir, file))

      // Process files with basic parallelism using Promise.all with chunks
      const chunkSize = 10
      for (let i = 0; i < zipFiles.length; i += chunkSize) {
        const chunk = zipFiles.slice(i, i + chunkSize)
        await Promise.all(chunk.map(processZip))
      }
      return
    }
    if (hasNodeModules) {
      console.error('\x1b[36mScanning node_modules...\x1b[0m')
      const packageJsonFiles = Array.from(findPackageJsonFiles(nodeModulesDir))

      // Process with same chunking strategy
      const chunkSize = 10
      for (let i = 0; i < packageJsonFiles.length; i += chunkSize) {
        const chunk = packageJsonFiles.slice(i, i + chunkSize)
        await Promise.all(chunk.map(processNodeModulesPackage))
      }
      return
    }
    console.error(`No ${yarnCacheDir} or ${nodeModulesDir} directory found`)
    process.exit(1)
  } catch (err) {
    console.error('[Error]', err.message)
    process.exit(1)
  }
}

main()
