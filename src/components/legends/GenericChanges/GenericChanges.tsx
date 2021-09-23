import { DatasetType } from "../../Utility/Data/DatasetType";
import { IVect } from "../../Utility/Data/Vect";
import { Dataset } from "../../Utility/Data/Dataset";
import { connect } from 'react-redux'
import { RubikChanges } from "../RubikChanges/RubikChanges";
import React = require("react");
import { ChessChanges } from "../ChessChanges/ChessChanges";
import { CoralChanges } from "../CoralChanges/CoralChanges";
import { ChemLegendParent } from "../ChemDetail/ChemDetail";


type GenericChangesType = {
    vectorsA: Array<IVect>
    vectorsB: Array<IVect>
    dataset: Dataset
    scale: number
}

const mapStateToProps = state => ({
    dataset: state.dataset
})

const mapDispatchToProps = dispatch => ({
})

export const GenericChanges = connect(mapStateToProps, mapDispatchToProps)(({ vectorsA, vectorsB, dataset, scale } : GenericChangesType) => {
    switch (dataset.type) {
        case DatasetType.Rubik:
            return <RubikChanges width={81 * scale} height={108 * scale} vectorsA={vectorsA} vectorsB={vectorsB}></RubikChanges>
        case DatasetType.Chess:
            return <ChessChanges width={144 * scale} height={144 * scale} vectorsA={vectorsA} vectorsB={vectorsB}></ChessChanges>
        case DatasetType.Cohort_Analysis:
            return <CoralChanges width={80 * scale} height={80 * scale} vectorsA={vectorsA} vectorsB={vectorsB} scale={scale}></CoralChanges>
        case DatasetType.Chem:
            return <ChemLegendParent selection={vectorsA} selection_ref={vectorsB} diff={true} aggregate={true} mcs_only={true}></ChemLegendParent>
        default:
            return <CoralChanges width={80 * scale} height={80 * scale} vectorsA={vectorsA} vectorsB={vectorsB} scale={scale}></CoralChanges>
    }
})