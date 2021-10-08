import { Button, Checkbox, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, FormGroup, FormLabel, Grid, InputLabel, makeStyles, MenuItem, Paper, Select, Switch, TextField } from '@material-ui/core';
import React = require('react')
import { connect, ConnectedProps } from 'react-redux'
import trailSettings from '../../Ducks/TrailSettingsDuck';
import { RootState } from '../../Store/Store';
import FeaturePicker from './FeaturePicker';
import clone = require('fast-clone')

const mapState = (state: RootState) => ({
    projectionColumns: state.projectionColumns
})

const mapDispatch = dispatch => ({
})

const connector = connect(mapState, mapDispatch);

type PropsFromRedux = ConnectedProps<typeof connector>

type Props = PropsFromRedux & {
    domainSettings: any
    open: boolean
    onClose: any
    onStart: any
    projectionParams: any
}

const useStyles = makeStyles((theme) => ({
    root: {
        margin: theme.spacing(3)
    },
}));

const TSNESettings = ({ learningRate, setLearningRate, perplexity, setPerplexity }) => {


    return <FormGroup>
        <TextField
            id="textPerplexity"
            label="Perplexity"
            type="number"
            value={perplexity}
            onChange={(event) => {
                setPerplexity(event.target.value)
            }}
        />
        <TextField
            id="textLearningRate"
            label="Learning Rate"
            type="number"
            value={learningRate}
            onChange={(event) => {
                setLearningRate(event.target.value)
            }}
        />
    </FormGroup>
}

const UMAPSettings = ({ nNeighbors, setNNeighbors }) => {

    return <FormGroup>
        <TextField
            id="textNNeighbors"
            label="n Neighbors"
            type="number"
            value={nNeighbors}
            onChange={(event) => {
                setNNeighbors(event.target.value)
            }}
        />
    </FormGroup>
}

const GenericSettingsComp = ({ domainSettings, open, onClose, onStart, projectionParams, projectionColumns }: Props) => {
    const classes = useStyles();

    const [perplexity, setPerplexity] = React.useState(projectionParams.perplexity)
    const [learningRate, setLearningRate] = React.useState(projectionParams.learningRate)
    const [nNeighbors, setNNeighbors] = React.useState(projectionParams.nNeighbors)
    const [iterations, setIterations] = React.useState(projectionParams.iterations)
    const [seeded, setSeeded] = React.useState(projectionParams.seeded)
    const [useSelection, setUseSelection] = React.useState(projectionParams.useSelection)

    const [distanceMetric, setDistanceMetric] = React.useState(projectionParams.distanceMetric)

    const cloneColumns = (projectionColumns) => {
        return projectionColumns.map(val => {
            return clone(val)
        })
    }

    const [selection, setSelection] = React.useState(cloneColumns(projectionColumns))

    React.useEffect(() => {
        if (open) {
            setSelection(cloneColumns(projectionColumns))
        }
    }, [projectionColumns, open])


    return <Dialog maxWidth='lg'
        open={open}
        onClose={onClose}>

        <DialogContent>
            <Container>
                {domainSettings != 'forceatlas2' && <FeaturePicker selection={selection} setSelection={setSelection}></FeaturePicker>}


                <Grid container justify="center" style={{ width: '100%' }}>
                    <Grid item>
                        <FormControl className={classes.root}>
                            <FormLabel component="legend">Projection Parameters</FormLabel>

                            {domainSettings == 'umap' && <UMAPSettings nNeighbors={nNeighbors} setNNeighbors={setNNeighbors}></UMAPSettings>}
                            {domainSettings == 'tsne' && <TSNESettings learningRate={learningRate} setLearningRate={setLearningRate} perplexity={perplexity} setPerplexity={setPerplexity}></TSNESettings>}
                        </FormControl>
                    </Grid>

                    <Grid item>
                        <FormControl className={classes.root}>
                            <FormLabel component="legend">General Parameters</FormLabel>
                            <FormGroup>
                                <TextField
                                    id="textIterations"
                                    label="Iterations"
                                    type="number"
                                    value={iterations}
                                    onChange={(event) => {
                                        setIterations(event.target.value)
                                    }}
                                />
                                <FormControlLabel
                                    control={<Checkbox color="primary" checked={seeded} onChange={(_, checked) => setSeeded(checked)} name="jason" />}
                                    label="Seed Position"
                                />
                                <FormControlLabel
                                    control={<Checkbox color="primary" checked={useSelection} onChange={(_, checked) => setUseSelection(checked)} />}
                                    label="Project Selection Only"
                                />
                                {(domainSettings == 'tsne' || domainSettings == 'umap') && <FormControl>
                                    <InputLabel id="demo-controlled-open-select-label">Distance Metric</InputLabel>
                                    <Select
                                        labelId="demo-controlled-open-select-label"
                                        id="demo-controlled-open-select"
                                        value={distanceMetric}
                                        onChange={(event) => { setDistanceMetric(event.target.value) }}
                                    >
                                        <MenuItem value={'euclidean'}>Euclidean</MenuItem>
                                        <MenuItem value={'jaccard'}>Jaccard</MenuItem>
                                    </Select>
                                </FormControl>}
                            </FormGroup>
                        </FormControl>
                    </Grid>
                </Grid>
            </Container>
        </DialogContent>
        <DialogActions>
            <Button color="primary" onClick={onClose}>Cancel</Button>
            <Button color="primary" onClick={() => {
                onStart({
                    iterations: iterations,
                    perplexity: perplexity,
                    learningRate: learningRate,
                    seeded: seeded,
                    nNeighbors: nNeighbors,
                    method: domainSettings,
                    useSelection: useSelection,
                    distanceMetric: distanceMetric
                }, selection)
            }}>Start</Button>
        </DialogActions>
    </Dialog >
}

export const GenericSettings = connector(GenericSettingsComp)