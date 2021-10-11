import Button from '@material-ui/core/Button';
import { Grid, withTheme } from '@material-ui/core';
import * as React from 'react'

type DragAndDropProps = {
    handleDrop: Function
    accept: string
    theme: any
}

type DragAndDropState = {
    drag: boolean
}

class DragAndDrop extends React.Component<DragAndDropProps, DragAndDropState> {
    dragCounter: number
    dropRef: any

    constructor(props) {
        super(props)

        this.state = {
            drag: false
        }
        this.dragCounter = 0
        this.dropRef = React.createRef()
    }

    handleDrag = (e) => {
        e.preventDefault()
        e.stopPropagation()
    }
    handleDragIn = (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.dragCounter = 1

        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            this.setState({ drag: true })
        }
    }
    handleDragOut = (e) => {
        e.preventDefault()
        e.stopPropagation()

        var rect = this.dropRef.current.getBoundingClientRect()
        if (e.clientY < rect.top || e.clientY >= rect.bottom || e.clientX < rect.left || e.clientX >= rect.right) {
            this.dragCounter = 0
            this.setState({ drag: false })
        }
    }
    handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.setState({ drag: false })
        this.dragCounter = 0
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            this.props.handleDrop(e.dataTransfer.files)
            //e.dataTransfer.clearData()

        }
    }
    componentDidMount() {
        let div = this.dropRef.current
        div.addEventListener('dragenter', this.handleDragIn)
        div.addEventListener('dragleave', this.handleDragOut)
        div.addEventListener('dragover', this.handleDrag)
        div.addEventListener('drop', this.handleDrop)
    }
    componentWillUnmount() {
        let div = this.dropRef.current
        div.removeEventListener('dragenter', this.handleDragIn)
        div.removeEventListener('dragleave', this.handleDragOut)
        div.removeEventListener('dragover', this.handleDrag)
        div.removeEventListener('drop', this.handleDrop)
    }
    render() {
        return (
            <div
                id="master"
                style={{ display: 'inline-block', position: 'relative' }}
                ref={this.dropRef}
            >
                {this.state.drag ?
                    <div
                        style={{
                            border: 'dashed blue 2px',
                            position: 'absolute',
                            borderRadius: '4px',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            right: 0
                        }}
                    >
                        <Grid style={{ height: '100%' }} container direction="column" justifyContent="center" alignItems="center">
                            <div
                                style={{

                                    textAlign: 'center',
                                    color: 'grey',
                                    fontSize: 24
                                }}>
                                <div>Drop a file here</div>
                            </div>
                        </Grid>
                    </div> :
                    <div
                        style={{
                            border: 'dashed grey 2px',
                            position: 'absolute',
                            borderRadius: '4px',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            right: 0
                        }}
                    >
                        <Grid style={{ height: '100%' }} container direction="column" justifyContent="center" alignItems="center">
                            <input
                                style={{ display: 'none' }}
                                id="contained-button-file"
                                multiple
                                type="file"
                                onChange={(e) => {
                                    this.props.handleDrop(e.target.files)
                                }}
                            />
                            <label htmlFor="contained-button-file">
                                <Button variant="outlined" component="span">
                                    Open File
                            </Button>
                            </label>

                            <div
                                style={{

                                    textAlign: 'center',
                                    color: 'grey',
                                    fontSize: 24
                                }}>
                                <div>Drop a file here</div>
                            </div>
                        </Grid>
                    </div>
                }
                {this.props.children}
            </div>
        )
    }
}
export default withTheme(DragAndDrop)