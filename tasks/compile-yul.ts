import { promises as filesystem } from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { task } from 'hardhat/config'

const execAsync = promisify(exec)

interface CompilerConfig {
	resolcPath: string;
	solcPath: string;
	inputFile: string;
	outputDir: string;
	outputFile: string;
}

const defaultConfig: CompilerConfig = {
	resolcPath: process.env.RESOLC_PATH || '~/.cargo/bin/resolc-0.1.0-dev.16',
	solcPath: process.env.SOLC_PATH || '/opt/homebrew/bin/solc',
	inputFile: 'contracts/deterministic-deployment-proxy.yul',
	outputDir: 'output',
	outputFile: 'bytecode.txt'
}

export async function ensureDirectoryExists(absoluteDirectoryPath: string) {
	try {
		await filesystem.mkdir(absoluteDirectoryPath)
	} catch (error) {
		if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'EEXIST') return
		throw error
	}
}

async function writeBytecode(bytecode: string, outputPath: string) {
	await filesystem.writeFile(outputPath, bytecode, { encoding: 'utf8', flag: 'w' })
}

async function compileWithYul(config: Partial<CompilerConfig> = {}) {
	const finalConfig = { ...defaultConfig, ...config }
	const yulPath = path.join(__dirname, '..', finalConfig.inputFile)
	const outputDir = path.join(__dirname, '..', finalConfig.outputDir)
	const outputPath = path.join(outputDir, finalConfig.outputFile)
	
	const command = `${finalConfig.resolcPath} --solc ${finalConfig.solcPath} --yul ${yulPath} --bin`
	
	try {
		const { stdout } = await execAsync(command)
		await ensureDirectoryExists(outputDir)
		const bytecode = stdout.split('bytecode:')[1]?.trim() || ''
		await writeBytecode(bytecode, outputPath)
		return bytecode
	} catch (error) {
		console.error('Compilation failed:', error)
		throw error
	}
}

task('compile:yul', 'Compile Yul contract using resolc')
	.addOptionalParam('input', 'Input Yul file path', defaultConfig.inputFile)
	.addOptionalParam('output', 'Output file name', defaultConfig.outputFile)
	.addOptionalParam('outputDir', 'Output directory', defaultConfig.outputDir)
	.addOptionalParam('resolcPath', 'Path to resolc compiler', defaultConfig.resolcPath)
	.addOptionalParam('solcPath', 'Path to solc compiler', defaultConfig.solcPath)
	.setAction(async (taskArgs, hre) => {
		const config: Partial<CompilerConfig> = {
			inputFile: taskArgs.input,
			outputFile: taskArgs.output,
			outputDir: taskArgs.outputDir,
			resolcPath: taskArgs.resolcPath,
			solcPath: taskArgs.solcPath
		}

		console.log('Compiling Yul contract...')
		const bytecode = await compileWithYul(config)
		console.log('Compilation successful!')
		console.log(`Bytecode written to: ${path.join(config.outputDir || defaultConfig.outputDir, config.outputFile || defaultConfig.outputFile)}`)
		return bytecode
	})

// 导出配置接口和编译函数供其他模块使用
export { CompilerConfig, compileWithYul }

// 如果直接运行此文件
if (require.main === module) {
	compileWithYul().then(() => {
		process.exit(0)
	}).catch(error => {
		console.error(error)
		process.exit(1)
	})
}