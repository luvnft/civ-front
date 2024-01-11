import React from 'react'
import { Button, Grid } from '@mui/material'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useNavigate } from "react-router-dom";

import { useWorkspace } from '../context/AnchorContext';
import { requestBackendAirdrop, requestSolanaAirdrop, registerPlayerAddress } from '../utils/initiateGame'
import { initializeGame } from '../utils/solanaUtils';
import { useModalError } from '../context/ModalErrorContext';

const { REACT_APP_HELIUS_RPC } = process.env;

interface InitiateGameButtonProps {
  setShowButtons: (showButtons: boolean) => void;
  updateStepStatus: (step: string, status: string) => void;
  setErrorMsg: (errorMsg: string) => void;
  label?: string
}

const InitiateGameButton = ({ setShowButtons, updateStepStatus, setErrorMsg, label = "Play with bots" }: InitiateGameButtonProps) => {
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const { setShowModalError } = useModalError();

  const createWalletAndStartGame = async () => {
    setShowButtons(false);
    const connection = workspace.connection as Connection;
    const wallet = {
      publicKey: workspace.provider?.publicKey as PublicKey,
    };
    const minAmount = 0.25;
    try {
      const balance = await connection.getBalance(wallet.publicKey);
      if (balance < minAmount * LAMPORTS_PER_SOL) {
        try {
          // First airdrop attempt
          await requestSolanaAirdrop(connection, wallet.publicKey);
        } catch (error1) {
          console.log("First airdrop attempt failed:", error1);
          try {
            // Second airdrop attempt using a different RPC
            const heliusConnection = new Connection(
              REACT_APP_HELIUS_RPC || "https://api.devnet.solana.com",
              "confirmed"
            );
            await requestSolanaAirdrop(heliusConnection, wallet.publicKey);
          } catch (error2) {
            console.log("Second airdrop attempt failed:", error2);
            // Third airdrop attempt using backend
            const backendSuccess = await requestBackendAirdrop(wallet.publicKey.toBase58());
            if (!backendSuccess) {
              throw new Error("All airdrop attempts failed. Please fund your wallet using web faucet:");
            }
          }
        }
        updateStepStatus("Requesting airdrop", "completed");
      }
    } catch (error) {
      console.log("Error while requesting airdrop: ", error);
      updateStepStatus("Requesting airdrop", "failed");
      setErrorMsg(`Airdrop request failed: ${error}`);
      setShowButtons(true);
      return;
    }

    try {
      const provider = workspace.provider!;
      const program = workspace.program!;
      await initializeGame(provider, program);
      await registerPlayerAddress(wallet.publicKey.toBase58());
      updateStepStatus("Initializing game", "completed");
      setShowModalError(false);
    } catch (error) {
      console.log("Error while initializing the game: ", error);
      updateStepStatus("Initializing game", "failed");
      setErrorMsg(`Initializing game failed: ${error}`);
      setShowButtons(true);
      return;
    }

    label === "Initiate" ? navigate(0) : navigate("/game");
  }
  
  return (
    <Grid item xs={12}>
      <Button
        variant="contained"
        color="primary"
        className="fixed-width-button"
        onClick={createWalletAndStartGame}
      >
        {label}
      </Button>
    </Grid>
  )
}

export default InitiateGameButton