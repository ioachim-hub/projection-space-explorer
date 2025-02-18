/* eslint-disable react-hooks/exhaustive-deps */
import * as React from 'react';
import { Card, CardHeader, IconButton } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import CloseIcon from '@mui/icons-material/Close';
import { connect, ConnectedProps } from 'react-redux';
import { makeStyles } from '@mui/styles';
import type { RootState } from '../../Store/Store';

/**
 * Styles for the projection card that allows to stop/resume projection steps.
 */
const useStylesMedia = makeStyles(() => ({
  root: {
    display: 'flex',
    margin: '8px 0',
    pointerEvents: 'auto',
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  content: {
    flex: '1 0 auto',
  },
  cover: {
    width: 151,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'column',
    // paddingLeft: theme.spacing(1),
    // paddingBottom: theme.spacing(1),
    width: '100%',
  },
  playIcon: {
    height: 38,
    width: 38,
  },
}));

const mapStateToProps = (state: RootState) => ({
  projectionParams: state.projectionParams,
  worker: state.projectionWorker,
});

const mapDispatch = () => ({});

const connector = connect(mapStateToProps, mapDispatch);

type PropsFromRedux = ConnectedProps<typeof connector>;

type Props = PropsFromRedux & {
  onClose: any;
  onComputingChanged: any;
  controller: any;
  dataset_name: string;
  onStep?: any;
};

/**
 * Projection card that allows to start/stop the projection and shows the current steps.
 */
export const ProjectionControlCard = connector(({ onComputingChanged, projectionParams, controller, onClose, dataset_name, onStep }: Props) => {
  if (controller == null) return null;

  const classes = useStylesMedia();

  const [step, setStep] = React.useState(0);
  const [msg, setMsg] = React.useState('');
  const ref = React.useRef(step);

  if (step === 0) {
    console.time(`time elapsed to project the file ${dataset_name}`);
  }
  if (step / projectionParams.iterations >= 1) {
    console.timeEnd(`time elapsed to project the file ${dataset_name}`);
  }

  const [computing, setComputing] = React.useState(true);

  function updateState(newState) {
    ref.current = newState;
    setStep(newState);
  }

  controller.notifier = (step?: number, msg?: string) => {
    setMsg(msg);
    let new_step = ref.current + 1;
    if (step != null && !Number.isNaN(step)) {
      // checks if step is not null or undefined or nan
      new_step = step;
    }
    updateState(new_step);
    if (onStep) {
      onStep(new_step);
    }
  };

  React.useEffect(() => {
    if (step < projectionParams.iterations && computing) {
      controller.step();
    }
  }, [step, computing]);

  const genlabel = (step) => {
    if (step === 0) {
      return (
        <div>
          <div>Initializing Projection ...</div>
          {msg && <div>Server: {msg}</div>}
        </div>
      );
    }
    const percent = Math.min((step / projectionParams.iterations) * 100, 100).toFixed(1);
    return (
      <div>
        <div>{`${Math.min(step, projectionParams.iterations)}/${projectionParams.iterations}`}</div>
        <div>{`${percent}%`}</div>
        {msg && <div>Server: {msg}</div>}
      </div>
    );
  };

  return (
    <Card className={classes.root}>
      <div className={classes.details}>
        <CardHeader
          avatar={<div />}
          action={
            <IconButton
              aria-label="settings"
              onClick={() => {
                console.timeEnd(`time elapsed to project the file ${dataset_name}`);
                onClose();
              }}
            >
              <CloseIcon />
            </IconButton>
          }
          title={projectionParams.method}
          subheader={genlabel(step)}
        />
        <div className={classes.controls}>
          <IconButton
            aria-label="play/pause"
            data-cy="projection-card-play-pause-button"
            onClick={() => {
              const newVal = !computing;
              setComputing(newVal);
              onComputingChanged(null, newVal);
            }}
          >
            {/* TODO: don't show play/pause for back-end projection, since it does not do anything */}
            {computing ? <StopIcon className={classes.playIcon} /> : <PlayArrowIcon className={classes.playIcon} />}
          </IconButton>
        </div>
      </div>
    </Card>
  );
});
