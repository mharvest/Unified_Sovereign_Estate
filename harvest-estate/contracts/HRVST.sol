// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessRoles} from "./AccessRoles.sol";

/**
 * @title HRVST Sovereign Liquidity Token
 * @notice ERC20-style token collateralised by insured CSDNs/SDNs. Minting is constrained
 *         by Matriarch policy floor and aggregate NAV inputs.
 */
contract HRVST is AccessRoles {
    string public constant NAME = "Harvest Sovereign Liquidity";
    string public constant SYMBOL = "HRVST";
    uint8 public constant DECIMALS = 18;

    uint256 public totalSupply;
    uint256 public policyFloorBps;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event MintByNAV(
        address indexed to,
        uint256 amount,
        uint256 navCsdn,
        uint256 navSdn,
        uint256 floorBps
    );

    constructor(address admin, uint256 floorBps) AccessRoles(admin) {
        require(floorBps <= 10_000, "FLOOR_TOO_HIGH");
        policyFloorBps = floorBps;
    }

    function name() external pure returns (string memory) {
        return NAME;
    }

    function symbol() external pure returns (string memory) {
        return SYMBOL;
    }

    function decimals() external pure returns (uint8) {
        return DECIMALS;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 value) external returns (bool) {
        _allowances[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= value, "ALLOWANCE");
        if (currentAllowance != type(uint256).max) {
            _allowances[from][msg.sender] = currentAllowance - value;
            emit Approval(from, msg.sender, _allowances[from][msg.sender]);
        }
        _transfer(from, to, value);
        return true;
    }

    function mintByNAV(
        uint256 navCsdn,
        uint256 navSdn,
        uint256 floorBps,
        address to
    ) external onlyRole(TRUSTEE_ROLE) returns (uint256 mintedAmount) {
        require(to != address(0), "INVALID_TO");
        require(floorBps <= policyFloorBps, "POLICY_FLOOR");

        uint256 totalNav = navCsdn + navSdn;
        uint256 maxMintable = (totalNav * floorBps) / 10_000;
        require(maxMintable > totalSupply, "Policy floor");

        mintedAmount = maxMintable - totalSupply;
        _mint(to, mintedAmount);
        emit MintByNAV(to, mintedAmount, navCsdn, navSdn, floorBps);
    }

    function burnFrom(address account, uint256 amount) external onlyRole(TRUSTEE_ROLE) {
        _burn(account, amount);
    }

    function setPolicyFloor(uint256 floorBps) external onlyRole(ADMIN_ROLE) {
        require(floorBps <= 10_000, "FLOOR_TOO_HIGH");
        policyFloorBps = floorBps;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "INVALID_TO");
        uint256 balance = _balances[from];
        require(balance >= value, "BALANCE");
        unchecked {
            _balances[from] = balance - value;
        }
        _balances[to] += value;
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        uint256 balance = _balances[from];
        require(balance >= amount, "BALANCE");
        unchecked {
            _balances[from] = balance - amount;
        }
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }
}
