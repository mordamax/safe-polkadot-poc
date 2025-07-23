// SPDX-License-Identifier: MIT
// solc-version: 0.8.29

object "Proxy" {
	// deployment code
	code {
		let size := datasize("Proxy_deployed")
		datacopy(0, dataoffset("Proxy_deployed"), size)
		return(0, size)
	}
	object "Proxy_deployed" {
		// deployed code
		code {
			calldatacopy(0, 32, sub(calldatasize(), 32))
			let result := create2(callvalue(), 0, sub(calldatasize(), 32), calldataload(0))
			if iszero(result) { revert(0, 0) }
			mstore(0, result)
			return(12, 20)
		}
	}
}