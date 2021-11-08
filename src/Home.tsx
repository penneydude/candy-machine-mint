import { useEffect, useState } from "react";
import styled from "styled-components";
import Countdown from "react-countdown";
import { Button, CircularProgress, Snackbar } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import { parseJSON, isPast } from 'date-fns'

import * as anchor from "@project-serum/anchor";

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletDialogButton, WalletDisconnectButton } from "@solana/wallet-adapter-material-ui";

import { ScoopLogoSVG } from './svg/ScoopLogo';

import {
  CandyMachine,
  awaitTransactionSignatureConfirmation,
  getCandyMachineState,
  mintOneToken,
  shortenAddress,
} from "./candy-machine";

export interface HomeProps {
  candyMachineId: anchor.web3.PublicKey;
  config: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  startDate: number;
  treasury: anchor.web3.PublicKey;
  txTimeout: number;
}

const freezerOpenDate = parseJSON(process.env.REACT_APP_FREEZER_OPEN_DATE!);

const MainContainer = styled.div`
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: transparent;

  & img.first-freezer {
    height: 200px;
    margin-bottom: 48px;
  }
`;

const Header = styled.div`
  display: flex;
  flex-flow: row-nowrap;
  justify-content: space-between;
  position: absolute;
  top: 0;
  width: 100%;

  & p {
    margin: 24px;
  }

  & img.wordmark {
    height: 48px;
    margin-bottom: 6px;
    margin-left: 4px;
    opacity: 0.5;
  }

  & .scoopLogo {
    width: 64px;
    height: 64px;
    transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);

    & .eyes {
      fill: #fff;
    }

    & .cone {
      fill: rgba(255, 255, 255, 0);
      stroke: #fff;
      stroke-width: 8px;
      transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
    }

    & .bg {
      fill: none;
    }

    &:hover {
      & .cone {
        fill: #768BF9;
      }
    }
  }
`;

const ConnectButton = styled(WalletDialogButton)`
  & .MuiIconButton-root {
    color: #fff;
  }

  & .MuiButton-label {
    font-size: 18px;
    font-weight: 700;
  }
`;

const CounterText = styled.span``;

const MintContainer = styled.div`
  background-color: transparent;
`;

const CountContainer = styled.div`
  background-color: rgba(255, 255, 255, 0.15);
  font-size: 18px;
  font-weight: 700;
  padding: 12px 48px;
  margin: 8px 0 24px 0;
  border: 1px solid #fff;
  border-radius: 8px;
`;

const MintButton = styled(Button)`
  color: #fff !important;
  font-size: 24px !important;
  font-weight: 700 !important;
  padding: 16px 48px !important;
  border-color: #768BF9;
  border-radius: 100px !important;
  box-shadow: inset 0 0 20px 40px #768BF9;
  background: linear-gradient(-30deg, #768BF9, #00DBDE, #FC00FF, #768BF9, #00DBDE, #FC00FF, #768BF9);
  background-size: 680% 680%;
  animation: gradient 2s linear infinite;
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);

  ${props => props.disabled && `
    background: #000;
  `}

  &:hover {
    color: #fff;
    box-shadow: inset 0 0 20px 0 transparent;
  }

  @keyframes gradient {
    0% { background-position: 60% 60% }
    100% { background-position: 0% 0% }
  }
`;

const Home = (props: HomeProps) => {
  const [balance, setBalance] = useState<number>();
  const [isActive, setIsActive] = useState(isPast(freezerOpenDate)); // true when countdown completes
  const [isSoldOut, setIsSoldOut] = useState(false); // true when items remaining is zero
  const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT

  const [itemsAvailable, setItemsAvailable] = useState(0);
  const [itemsRedeemed, setItemsRedeemed] = useState(0);
  const [itemsRemaining, setItemsRemaining] = useState(0);

  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });

  const [startDate, setStartDate] = useState(new Date(props.startDate));

  const wallet = useAnchorWallet();
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();

  const refreshCandyMachineState = () => {
    (async () => {
      if (!wallet) return;

      const {
        candyMachine,
        goLiveDate,
        itemsAvailable,
        itemsRemaining,
        itemsRedeemed,
      } = await getCandyMachineState(
        wallet as anchor.Wallet,
        props.candyMachineId,
        props.connection
      );

      setItemsAvailable(itemsAvailable);
      setItemsRemaining(itemsRemaining);
      setItemsRedeemed(itemsRedeemed);

      setIsSoldOut(itemsRemaining === 0);
      setStartDate(goLiveDate);
      setCandyMachine(candyMachine);
    })();
  };

  const onMint = async () => {
    try {
      setIsMinting(true);
      if (wallet && candyMachine?.program) {
        const mintTxId = await mintOneToken(
          candyMachine,
          props.config,
          wallet.publicKey,
          props.treasury
        );

        const status = await awaitTransactionSignatureConfirmation(
          mintTxId,
          props.txTimeout,
          props.connection,
          "singleGossip",
          false
        );

        if (!status?.err) {
          setAlertState({
            open: true,
            message: "Congratulations! Mint succeeded!",
            severity: "success",
          });
        } else {
          setAlertState({
            open: true,
            message: "Mint failed! Please try again!",
            severity: "error",
          });
        }
      }
    } catch (error: any) {
      // TODO: blech:
      let message = error.msg || "Minting failed! Please try again!";
      if (!error.msg) {
        if (error.message.indexOf("0x138")) {
        } else if (error.message.indexOf("0x137")) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
          setIsSoldOut(true);
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }

      setAlertState({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
      setIsMinting(false);
      refreshCandyMachineState();
    }
  };

  useEffect(() => {
    (async () => {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
    })();
  }, [wallet, props.connection]);

  useEffect(refreshCandyMachineState, [
    wallet,
    props.candyMachineId,
    props.connection,
  ]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setIsActive(isPast(freezerOpenDate));
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <MainContainer>
      <Header>
        <p>
          <a href='/'><ScoopLogoSVG /></a>
          <img className="wordmark" src={`${process.env.PUBLIC_URL}/img/ScoopShopLogo.svg`} />
        </p>
        {wallet && (
          <p><WalletDisconnectButton>{shortenAddress(wallet.publicKey.toBase58() || "")}</WalletDisconnectButton></p>
        )}
      </Header>

      <img className="first-freezer" src={`${process.env.PUBLIC_URL}/img/SecondFreezer.svg`} />

      {/* {isActive && !isSoldOut ? (
        <>
          {wallet && <span>Scoops in the freezer</span>}
          {wallet && <CountContainer>{itemsRemaining} / {itemsAvailable}</CountContainer>}
        </>
      ) : (
        <>
          {wallet && !isSoldOut && <p>Freezer opens in</p>}
        </>
      )} */}


      {/* <MintContainer>
        {!wallet ? (
          <ConnectButton>Connect Wallet</ConnectButton>
        ) : (
          <MintButton
            disabled={isSoldOut || isMinting || !isActive}
            onClick={onMint}
            variant="contained"
          >
            {isSoldOut ? (
              "SOLD OUT"
            ) : isActive ? (
              isMinting ? (
                <CircularProgress />
              ) : (
                "MINT A SCOOP"
              )
            ) : (
              <Countdown
                date={freezerOpenDate}
                renderer={renderCounter}
              />
            )}
          </MintButton>
        )}
      </MintContainer> */}

      <MintContainer>
        <MintButton
          disabled
          onClick={() => {}}
          variant="contained"
        >
          CLOSED
        </MintButton>
      </MintContainer>

      {/* {(wallet && !isSoldOut) && <p>Scoops cost <b>◎0.48</b> each</p>} */}

      <Snackbar
        open={alertState.open}
        autoHideDuration={6000}
        onClose={() => setAlertState({ ...alertState, open: false })}
      >
        <Alert
          onClose={() => setAlertState({ ...alertState, open: false })}
          severity={alertState.severity}
        >
          {alertState.message}
        </Alert>
      </Snackbar>
    </MainContainer>
  );
};

interface AlertState {
  open: boolean;
  message: string;
  severity: "success" | "info" | "warning" | "error" | undefined;
}

const renderCounter = ({ days, hours, minutes, seconds, completed }: any) => {
  return (
    <CounterText>
      {hours + (days || 0) * 24} hours, {minutes} minutes, {seconds} seconds
    </CounterText>
  );
};

export default Home;
