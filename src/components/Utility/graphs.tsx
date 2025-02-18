/* eslint-disable no-param-reassign */
/**
 * Directed graph library for javascript.
 */

import { createEntityAdapter } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import { ICluster } from '../../model/ICluster';
import { Dataset } from '../../model/Dataset';
import { ObjectTypes } from '../../model/ObjectType';
import { IBook } from '../../model/Book';
import { IEdge } from '../../model/Edge';
import { clusterAdapter } from '../Ducks/StoriesDuck';

const edgeAdapter = createEntityAdapter<IEdge>({
  selectId: (edge) => edge.id,
});

export function transformIndicesToHandles(clusterResult: ICluster[], edgeResult?: IEdge[]) {
  const story: IBook = {
    id: uuidv4(),
    clusters: clusterAdapter.getInitialState(),
    edges: edgeAdapter.getInitialState(),
  };

  clusterResult.forEach((cluster, clusterIndex) => {
    const handle = clusterIndex.toString();

    story.clusters.entities[handle] = cluster;

    if (edgeResult != null) {
      edgeResult.forEach((edge) => {
        if (edge.source === clusterIndex.toString()) {
          edge.source = handle;
        }
        if (edge.destination === clusterIndex.toString()) {
          edge.destination = handle;
        }
      });
    }
  });

  if (edgeResult != null) {
    edgeResult.forEach((edge, i) => {
      const handle = i;

      story.edges.entities[handle] = edge;
    });
  }

  story.clusters.ids = Object.keys(story.clusters.entities);
  story.edges.ids = Object.keys(story.edges.entities);

  return story;
}

/**
 * Performs a basic path bundling algorithm and tries to extract
 * the most prominent edges between clusters.
 *
 * @param {Dataset} dataset the current dataset
 * @param {ICluster[]} clusters a list of clusters to perform the edge extraction
 */
export function graphLayout(dataset: Dataset, clusters: ICluster[]) {
  const edges: IEdge[] = [];

  // For each cluster,
  clusters.forEach((_, srcKey) => {
    const srcCluster = clusters[srcKey] as ICluster;
    clusters.forEach((_, dstKey) => {
      const dstCluster = clusters[dstKey] as ICluster;
      if (dstCluster !== srcCluster) {
        const bundle = [];

        // For each vector in source cluster, check if the direct ancestor is in the destination cluster
        srcCluster.indices
          .map((i) => dataset.vectors[i])
          .forEach((srcVec) => {
            if (
              dstCluster.indices
                .map((i) => dataset.vectors[i])
                .find((dstVec) => srcVec.line === dstVec.line && srcVec.__meta__.sequenceIndex + 1 === dstVec.__meta__.sequenceIndex)
            ) {
              bundle.push(srcVec.line);
            }
          });

        if (bundle.length > 10) {
          const edge: IEdge = {
            id: uuidv4(),
            objectType: ObjectTypes.Edge,
            source: srcKey.toString(),
            destination: dstKey.toString(),
            name: null,
          };
          edges.push(edge);
        }
      }
    });
  });

  return [edges];
}

export function storyLayout(clusterInstances: ICluster[], edges: IEdge[]): IBook[] {
  const stories: IBook[] = [];
  const copy = edges.slice(0);
  let idx = -1;

  while (copy.length > 0) {
    const toProcess = [copy.splice(0, 1)[0]];

    const clusterSet = new Set<ICluster>();
    const edgeSet = new Set<IEdge>();

    while (toProcess.length > 0) {
      const edge = toProcess.splice(0, 1)[0];
      do {
        clusterSet.add(clusterInstances[edge.source]);
        clusterSet.add(clusterInstances[edge.destination]);

        edgeSet.add(edge);

        idx = copy.findIndex((value) => value.destination === edge.source || value.source === edge.destination);
        if (idx >= 0) {
          const removed = copy.splice(idx, 1)[0];
          clusterSet.add(clusterInstances[removed.source]);
          clusterSet.add(clusterInstances[removed.destination]);

          edgeSet.add(removed);
          toProcess.push(removed);
        }
      } while (idx >= 0);
    }

    const clusterResult = [...clusterSet];
    const edgeResult: IEdge[] = [...edgeSet].map((edge) => {
      return {
        id: uuidv4(),
        source: clusterResult.indexOf(clusterInstances[edge.source]).toString(),
        destination: clusterResult.indexOf(clusterInstances[edge.destination]).toString(),
        objectType: ObjectTypes.Edge,
      };
    });

    const story = transformIndicesToHandles(clusterResult, edgeResult);

    stories.push(story);
  }

  return stories;
}
