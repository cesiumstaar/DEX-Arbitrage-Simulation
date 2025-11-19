// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TokenA - Example ERC20 Token
contract TokenA is ERC20 {
    constructor() ERC20("Token A", "TKNA") {
        _mint(msg.sender, 1000000 * (10 ** decimals()));
    }
}

/// @title TokenB - Example ERC20 Token
contract TokenB is ERC20 {
    constructor() ERC20("Token B", "TKNB") {
        _mint(msg.sender, 1000000 * (10 ** decimals()));
    }
}
