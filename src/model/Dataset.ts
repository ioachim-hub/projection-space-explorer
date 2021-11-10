import { IEdge } from "./Edge";
import { ICluster } from "./Cluster";
import { FeatureType } from "./FeatureType";
import { DatasetType } from "./DatasetType";
import { DataLine } from "./DataLine";
import { IVector } from "./Vector";
import { mean, std } from "../components/NumTs/NumTs";
import { EncodingMethod } from "./EncodingMethod";
import { NormalizationMethod } from "./NormalizationMethod";


export enum PrebuiltFeatures {
    Line = 'line',
    ClusterLabel = 'groupLabel'
}
export const EXCLUDED_COLUMNS = ["__meta__", "x", "y", "algo", "age", "multiplicity", "objectType"];
export const EXCLUDED_COLUMNS_ALL = ["__meta__", "x", "y", "algo", "age", "multiplicity", "groupLabel", "objectType"];

export const DefaultFeatureLabel = "Default"

type ColumnType = {
    distinct: any
    isNumeric: boolean
    metaInformation: any
    featureType: FeatureType
    range: any
    featureLabel: string
    project: boolean
}



export class SegmentFN {

    /**
     * Calculates the maximum path length for this dataset.
     */
    static getMaxPathLength(dataset: Dataset) {
        if (dataset.isSequential) {
            return Math.max(...dataset.segments.map(segment => segment.vectors.length));
        } else {
            return 1;
        }
    }
}



export class DatasetUtil {
        /**
     * Calculates the dataset bounds for this set, eg the minimum and maximum x,y values
     * which is needed for the zoom to work correctly
     */
    static calculateBounds(dataset: Dataset) {
        var xAxis = dataset.vectors.map(vector => vector.x);
        var yAxis = dataset.vectors.map(vector => vector.y);

        var minX = Math.min(...xAxis);
        var maxX = Math.max(...xAxis);
        var minY = Math.min(...yAxis);
        var maxY = Math.max(...yAxis);

        var scaleBase = 100;
        var absoluteMaximum = Math.max(Math.abs(minX), Math.abs(maxX), Math.abs(minY), Math.abs(maxY));

        dataset.bounds = {
            scaleBase: scaleBase,
            scaleFactor: absoluteMaximum / scaleBase,
            x: {
                min: minX,
                max: maxX
            },
            y: {
                min: minY,
                max: maxY
            }
        };
    }



    /**
     * Returns an array of columns that are available in the vectors
     */
    static getColumns(dataset: Dataset, excludeGenerated = false) {
        var vector = dataset.vectors[0];

        if (excludeGenerated) {
            return Object.keys(vector).filter(e => !EXCLUDED_COLUMNS_ALL.includes(e));
        } else {
            return Object.keys(vector).filter(e => e != '__meta__');
        }
    }


     /**
     * Returns the vectors in this dataset as a 2d array, which
     * can be used as input for tsne for example.
     */
    static asTensor(dataset: Dataset, projectionColumns, samples?, encodingMethod?, normalizationMethod?) {
        if(encodingMethod === undefined){
            encodingMethod = EncodingMethod.ONEHOT;
        }
        if(normalizationMethod === undefined){
            normalizationMethod = NormalizationMethod.STANDARDIZE;
        }

        var tensor = [];

        function oneHot(n, length) {
            var arr = new Array(length).fill(0);
            arr[n] = 1;
            return arr;
        }

        let lookup = {

        }

        ;(samples ?? dataset.vectors).forEach(vector => {
            var data = [];
            projectionColumns.forEach(entry => {
                let column = entry.name;
                if (dataset.columns[column].isNumeric) {
                    if (dataset.columns[column].range && entry.normalized) {
                        if(normalizationMethod === NormalizationMethod.STANDARDIZE){ // map to 0 mean and unit standarddeviation
                            let m, s;
                            
                            if (column in lookup) {
                                m = lookup[column].mean
                                s = lookup[column].std
                            } else {
                                m = mean(dataset.vectors.map(v => +v[column]))
                                s = std(dataset.vectors.map(v => +v[column]))
    
                                lookup[column] = {
                                    mean: m,
                                    std: s
                                }
                            }
    
                            if(s <= 0) // when all values are equal in a column, the standard deviation can be 0, which would lead to an error
                                s = 1
    
                            data.push((+vector[column] - m) / s);

                        }else{ // map between [0;1]
                            let div = dataset.columns[column].range["max"]-dataset.columns[column].range["min"];
                            div = div > 0 ? div : 1;
                            data.push((+vector[column]-dataset.columns[column].range["min"])/div);
                        }
                    } else {
                        data.push(+vector[column]);
                    }
                } else {
                    if(encodingMethod === EncodingMethod.ONEHOT){ // Non numeric data can be converted using one-hot encoding
                        let hot_encoded = oneHot(dataset.columns[column].distinct.indexOf(vector[column]), dataset.columns[column].distinct.length);
                        data = data.concat(hot_encoded);
                    }else{ // or just be integer encoded
                        data.push(dataset.columns[column].distinct.indexOf(vector[column]));
                    }
                }
            });
            tensor.push(data);
        });

        
        var featureTypes = [];
        projectionColumns.forEach(entry => {
            let column = entry.name;
            switch(dataset.columns[column].featureType){
                case FeatureType.Binary:
                    featureTypes.push(FeatureType.Binary)
                    break;
                case FeatureType.Categorical:
                    if(encodingMethod === EncodingMethod.ONEHOT){ // if the categorical attribute gets one hot encoded, we set all resulting columns to be binary
                        featureTypes.concat(Array(dataset.columns[column].distinct.length).fill(FeatureType.Binary));
                    }else{ // otherwise, it is declared as categorical column that contains integer because we can only handle integers in the distance metrics
                        featureTypes.push(FeatureType.Categorical);
                    }
                    break;
                case FeatureType.Date:
                    // TODO: handle Date types
                    break;
                case FeatureType.Ordinal:
                    // TODO: handle Ordinal types
                    break;
                case FeatureType.Quantitative:
                    featureTypes.push(FeatureType.Quantitative)
                    break;
                case FeatureType.String:
                    // TODO: handle String types
                    break;
                default:
                    break;
            }
        });

        return {tensor: tensor, featureTypes: featureTypes};
    }
}




/**
 * Dataset class that holds all data, the ranges and additional stuff
 */
export class Dataset {
    vectors: IVector[];
    segments: DataLine[];
    bounds: { x; y; scaleBase; scaleFactor; };
    info: { path: string; type: DatasetType; };
    columns: { [name: string] : ColumnType }

    // The type of the dataset (or unknown if not possible to derive)
    type: DatasetType;

    // True if the dataset has multiple labels per sample
    multivariateLabels: boolean;

    // True if the dataset has sequential information (line attribute)
    isSequential: boolean;

    clusters: ICluster[];

    // The edges between clusters.
    clusterEdges: IEdge[];

    // Dictionary containing the key/value pairs for each column
    metaInformation

    categories: any



    constructor(vectors, ranges, info, featureTypes, metaInformation={}) {
        this.vectors = vectors;
        this.info = info;
        this.columns = {};
        this.type = this.info.type;
        this.metaInformation = metaInformation


        DatasetUtil.calculateBounds(this);
        this.calculateColumnTypes(ranges, featureTypes, metaInformation);
        this.checkLabels();

        // If the dataset is sequential, calculate the segments
        this.isSequential = this.checkSequential();
        if (this.isSequential) {
            this.segments = this.getSegs()
        }
    }

    getSegs(key = 'line') {
        let vectors = this.vectors

        // Get a list of lines that are in the set
        var lineKeys = [... new Set(vectors.map(vector => vector[key]))]


        var segments = lineKeys.map(lineKey => {
            var l = new DataLine(lineKey, vectors.filter(vector => vector[key] == lineKey).sort((a, b) => a.age - b.age))
            // Set segment of vectors
            l.vectors.forEach((v, vi) => {
                v.__meta__.sequenceIndex = vi
            })
            return l
        })

        return segments
    }


    // Checks if the dataset contains sequential data
    checkSequential() {
        var header = DatasetUtil.getColumns(this);

        // If we have no line attribute, its not sequential
        if (!header.includes(PrebuiltFeatures.Line)) {
            return false;
        }

        // If each sample is a different line, its not sequential either
        var set = new Set(this.vectors.map(vector => vector.line));

        return set.size != this.vectors.length;
    }

    checkLabels() {
        this.multivariateLabels = false;
        this.vectors.forEach(vector => {
            if (vector.groupLabel.length > 1) {
                this.multivariateLabels = true;
                return;
            }
        });
    }






    inferRangeForAttribute(key: string) {
        let values = this.vectors.map(sample => sample[key]);
        let numeric = true;
        let min = Number.MAX_SAFE_INTEGER;
        let max = Number.MIN_SAFE_INTEGER;

        values.forEach(value => {
            value = parseFloat(value);
            if (isNaN(value)) {
                numeric = false;
            } else if (numeric) {
                if (value < min) {
                    min = value;
                } 
                if (value > max) {
                    max = value;
                }
            }
        });

        return numeric ? { min: min, max: max, inferred: true } : null; // false
    }




    /**
     * Creates a map which shows the distinct types and data types of the columns.
     */
    calculateColumnTypes(ranges, featureTypes, metaInformation) {
        var columnNames = Object.keys(this.vectors[0]);

        if ('algo' in this.columns)
            this.columns['algo'].featureType = FeatureType.Categorical;
        if ('groupLabel' in this.columns)
            this.columns['groupLabel'].featureType = FeatureType.Categorical;
        if ('x' in this.columns)
            this.columns['x'].featureType = FeatureType.Quantitative;
        if ('y' in this.columns)
            this.columns['y'].featureType = FeatureType.Quantitative;

        featureTypes['algo'] = FeatureType.Categorical
        delete ranges['algo']

        featureTypes['groupLabel'] = FeatureType.Categorical
        delete ranges['groupLabel']

        columnNames.forEach(columnName => {
            // @ts-ignore
            this.columns[columnName] = { }
            
            this.columns[columnName].featureType = featureTypes[columnName];


            // Store dictionary with key/value pairs in column
            let columnMetaInformation = metaInformation[columnName] ?? {}
            this.columns[columnName].metaInformation = columnMetaInformation

            // Extract featureLabel from dictionary
            if ("featureLabel" in columnMetaInformation) {
                this.columns[columnName].featureLabel = columnMetaInformation["featureLabel"]
            } else {
                this.columns[columnName].featureLabel = DefaultFeatureLabel
            }


            // Extract included
            if ("project" in columnMetaInformation) {
                this.columns[columnName].project = columnMetaInformation["project"]
            } else {
                this.columns[columnName].project = true
            }



            // Check data type
            if (columnName in ranges) {
                this.columns[columnName].range = ranges[columnName];
            } else {
                if (this.vectors.find(vector => isNaN(vector[columnName])) || this.columns[columnName].featureType === FeatureType.Categorical) {
                    this.columns[columnName].isNumeric = false;
                    this.columns[columnName].distinct = Array.from(new Set([...this.vectors.map(vector => vector[columnName])]));
                } else {
                    this.columns[columnName].isNumeric = true;
                    this.columns[columnName].range = this.inferRangeForAttribute(columnName);
                }
            }
        });
    }


    /**
     * Infers an array of attributes that can be filtered after, these can be
     * categorical, sequential or continuous attribues.
     * @param {*} ranges
     */
     extractEncodingFeatures(ranges) {
        if (this.vectors.length <= 0) {
            return [];
        }

        var shape_options = []
        var size_options = []
        var transparency_options = []
        var color_options = []


        const columns = this.columns;
        var header = Object.keys(columns);
        // var header = Object.keys(this.vectors[0]).filter(a => a != "line");

        header.forEach(key => {
            if (key == PrebuiltFeatures.ClusterLabel) {
                color_options.push({
                    "key": key,
                    "name": key,
                    "type": "categorical"
                })
            } else {
                var shapes = ["circle", "star", "square", "cross"];
                switch(columns[key].featureType){
                    case FeatureType.Binary:
                        color_options.push({
                            "key": key,
                            "name": key,
                            "type": "categorical"
                        });

                        shape_options.push({
                            "key": key,
                            "name": key,
                            "type": "categorical", // TODO: is there difference for binary?
                            "values": columns[key].distinct.map((value, index) => {
                                return {
                                    from: value,
                                    to: shapes[index]
                                };
                            })
                        });
                        break;
                    case FeatureType.Categorical:
                        color_options.push({
                            "key": key,
                            "name": key,
                            "type": "categorical"
                        });

                        if (columns[key].distinct.length <= 4) {
                            var shapes = ["circle", "star", "square", "cross"];
                            shape_options.push({
                                "key": key,
                                "name": key,
                                "type": "categorical",
                                "values": columns[key].distinct.map((value, index) => {
                                    return {
                                        from: value,
                                        to: shapes[index]
                                    };
                                })
                            });
                        }
                        break;
                    case FeatureType.Date:
                        break;
                    case FeatureType.Ordinal:
                        color_options.push({
                            "key": key,
                            "name": key,
                            "type": "sequential", // TODO: add ordinal color scale
                            "range": columns[key].range
                        });
                        transparency_options.push({
                            "key": key,
                            "name": key,
                            "type": "sequential", // TODO: transparancy for ordered data?
                            "range": columns[key].range,
                            "values": {
                                range: [0.3, 1.0]
                            }
                        });
                        size_options.push({
                            "key": key,
                            "name": key,
                            "type": "sequential", // TODO: size for ordered data?
                            "range": columns[key].range,
                            "values": {
                                range: [1, 2]
                            }
                        });
                        break;
                    case FeatureType.Quantitative:
                        color_options.push({
                            "key": key,
                            "name": key,
                            "type": "sequential",
                            "range": columns[key].range
                        });
                        transparency_options.push({
                            "key": key,
                            "name": key,
                            "type": "sequential",
                            "range": columns[key].range,
                            "values": {
                                range: [0.3, 1.0]
                            }
                        });
                        size_options.push({
                            "key": key,
                            "name": key,
                            "type": "sequential",
                            "range": columns[key].range,
                            "values": {
                                range: [1, 2]
                            }
                        });
                        break;
                    case FeatureType.String:
                        break;
                    default:
                        break;
                }

            }
        });


        var options = [
            {
                "category": "shape",
                "attributes": shape_options
            },
            {
                "category": "size",
                "attributes": size_options
            },
            {
                "category": "transparency",
                "attributes": transparency_options
            },
            {
                "category": "color",
                "attributes": color_options
            }
        ];

        return options;
    }
}
