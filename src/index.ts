import { addPath, debug, getBooleanInput, getInput, setFailed } from '@actions/core'
import { downloadTool, extractZip, find as findTool } from '@actions/tool-cache'
import os from 'node:os'
import { setupVault } from './setup-vault'

const USER_AGENT = 'escapace/setup-vault'

export async function run() {
  try {
    const toolPath = await setupVault({
      arch: os.arch(),
      debug,
      downloadTool,
      enterprise: getBooleanInput('enterprise'),
      extractZip,
      findTool,
      platform: os.platform(),
      userAgent: USER_AGENT,
      version: getInput('vault-version'),
    })

    addPath(toolPath)
  } catch (error) {
    setFailed(
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown Error',
    )
  }
}

void run()
