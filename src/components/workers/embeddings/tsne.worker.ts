import 'regenerator-runtime/runtime';
import { euclidean, jaccard } from '../../Utility/UMAP/umap';
import { get_distance_fn } from '../../Utility/DistanceFunctions';

// create main global object
var tsnejs = tsnejs || { REVISION: 'ALPHA' };

(function (global) {
  // utility function
  const assert = function (condition, message) {
    if (!condition) {
      throw message || 'Assertion failed';
    }
  };

  // syntax sugar
  const getopt = function (opt, field, defaultval) {
    if (opt.hasOwnProperty(field)) {
      return opt[field];
    }
    return defaultval;
  };

  // return 0 mean unit standard deviation random number
  let return_v = false;
  let v_val = 0.0;
  var gaussRandom = function () {
    if (return_v) {
      return_v = false;
      return v_val;
    }
    const u = 2 * Math.random() - 1;
    const v = 2 * Math.random() - 1;
    const r = u * u + v * v;
    if (r == 0 || r > 1) return gaussRandom();
    const c = Math.sqrt((-2 * Math.log(r)) / r);
    v_val = v * c; // cache this for next function call for efficiency
    return_v = true;
    return u * c;
  };

  // return random normal number
  const randn = function (mu, std) {
    return mu + gaussRandom() * std;
  };

  // utilitity that creates contiguous vector of zeros of size n
  const zeros = function (n) {
    if (typeof n === 'undefined' || isNaN(n)) {
      return [];
    }
    if (typeof ArrayBuffer === 'undefined') {
      // lacking browser support
      const arr = new Array(n);
      for (let i = 0; i < n; i++) {
        arr[i] = 0;
      }
      return arr;
    }
    return new Float64Array(n); // typed arrays are faster
  };

  // utility that returns 2d array filled with random numbers
  // or with value s, if provided
  const randn2d = function (n, d, s) {
    const uses = typeof s !== 'undefined';
    const x = [];
    for (let i = 0; i < n; i++) {
      const xhere = [];
      for (let j = 0; j < d; j++) {
        if (uses) {
          xhere.push(s);
        } else {
          xhere.push(randn(0.0, 1e-4));
        }
      }
      x.push(xhere);
    }
    return x;
  };

  // compute L2 distance between two vectors
  const L2 = function (x1, x2) {
    const D = x1.length;
    let d = 0;
    for (let i = 0; i < D; i++) {
      const x1i = x1[i];
      const x2i = x2[i];
      d += (x1i - x2i) * (x1i - x2i);
    }
    return d;
  };

  // compute pairwise distance in all vectors in X
  const xtod = function (X, distanceFn) {
    const N = X.length;
    const dist = zeros(N * N); // allocate contiguous array
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const d = distanceFn(X[i], X[j]);
        dist[i * N + j] = d;
        dist[j * N + i] = d;
      }
    }
    return dist;
  };

  // compute (p_{i|j} + p_{j|i})/(2n)
  const d2p = function (D, perplexity, tol) {
    const Nf = Math.sqrt(D.length); // this better be an integer
    const N = Math.floor(Nf);
    assert(N === Nf, 'D should have square number of elements.');
    const Htarget = Math.log(perplexity); // target entropy of distribution
    const P = zeros(N * N); // temporary probability matrix

    const prow = zeros(N); // a temporary storage compartment
    for (var i = 0; i < N; i++) {
      let betamin = -Infinity;
      let betamax = Infinity;
      let beta = 1; // initial value of precision
      let done = false;
      const maxtries = 50;

      // perform binary search to find a suitable precision beta
      // so that the entropy of the distribution is appropriate
      let num = 0;
      while (!done) {
        // debugger;

        // compute entropy and kernel row with beta precision
        let psum = 0.0;
        for (var j = 0; j < N; j++) {
          var pj = Math.exp(-D[i * N + j] * beta);
          if (i === j) {
            pj = 0;
          } // we dont care about diagonals
          prow[j] = pj;
          psum += pj;
        }
        // normalize p and compute entropy
        let Hhere = 0.0;
        for (var j = 0; j < N; j++) {
          if (psum == 0) {
            var pj = 0;
          } else {
            var pj = prow[j] / psum;
          }
          prow[j] = pj;
          if (pj > 1e-7) Hhere -= pj * Math.log(pj);
        }

        // adjust beta based on result
        if (Hhere > Htarget) {
          // entropy was too high (distribution too diffuse)
          // so we need to increase the precision for more peaky distribution
          betamin = beta; // move up the bounds
          if (betamax === Infinity) {
            beta *= 2;
          } else {
            beta = (beta + betamax) / 2;
          }
        } else {
          // converse case. make distrubtion less peaky
          betamax = beta;
          if (betamin === -Infinity) {
            beta /= 2;
          } else {
            beta = (beta + betamin) / 2;
          }
        }

        // stopping conditions: too many tries or got a good precision
        num++;
        if (Math.abs(Hhere - Htarget) < tol) {
          done = true;
        }
        if (num >= maxtries) {
          done = true;
        }
      }

      // console.log('data point ' + i + ' gets precision ' + beta + ' after ' + num + ' binary search steps.');
      // copy over the final prow to P at row i
      for (var j = 0; j < N; j++) {
        P[i * N + j] = prow[j];
      }
    } // end loop over examples i

    // symmetrize P and normalize it to sum to 1 over all ij
    const Pout = zeros(N * N);
    const N2 = N * 2;
    for (var i = 0; i < N; i++) {
      for (var j = 0; j < N; j++) {
        Pout[i * N + j] = Math.max((P[i * N + j] + P[j * N + i]) / N2, 1e-100);
      }
    }

    return Pout;
  };

  // helper function
  function sign(x) {
    return x > 0 ? 1 : x < 0 ? -1 : 0;
  }

  const tSNE = function (opt) {
    var opt = opt || {};
    this.perplexity = getopt(opt, 'perplexity', 30); // effective number of nearest neighbors
    this.dim = getopt(opt, 'dim', 2); // by default 2-D tSNE
    this.epsilon = getopt(opt, 'epsilon', 10); // learning rate
    this.distanceFn = getopt(opt, 'distanceFn', euclidean);

    this.iter = 0;
  };

  tSNE.prototype = {
    // this function takes a set of high-dimensional points
    // and creates matrix P from them using gaussian kernel
    initDataRaw(X) {
      const N = X.length;
      const D = X[0].length;
      assert(N > 0, ' X is empty? You must have some data!');
      assert(D > 0, ' X[0] is empty? Where is the data?');
      const dists = xtod(X, this.distanceFn); // convert X to distances using gaussian kernel
      this.P = d2p(dists, this.perplexity, 1e-4); // attach to object
      this.N = N; // back up the size of the dataset
      this.initSolution(); // refresh this
    },

    initDataSeeded(X, seed) {
      const N = X.length;
      const D = X[0].length;
      assert(N > 0, ' X is empty? You must have some data!');
      assert(D > 0, ' X[0] is empty? Where is the data?');
      const dists = xtod(X, this.distanceFn); // convert X to distances using gaussian kernel
      this.P = d2p(dists, this.perplexity, 1e-4); // attach to object
      this.N = N; // back up the size of the dataset

      // generate random solution to t-SNE
      if (seed) {
        const maxX = Math.max(...seed.map((s) => s[0]));
        const minX = Math.min(...seed.map((s) => s[0]));
        const maxY = Math.max(...seed.map((s) => s[1]));
        const minY = Math.min(...seed.map((s) => s[1]));

        const abs = Math.max(Math.abs(minX), Math.abs(maxX), Math.abs(minY), Math.abs(maxY));

        const result = [];
        for (let i = 0; i < this.N; i++) {
          result.push([seed[i][0] / abs / 1000, seed[i][1] / abs / 1000]);
        }
        this.Y = result;
      } else {
        this.Y = randn2d(this.N, this.dim, undefined); // the solution
      }

      this.gains = randn2d(this.N, this.dim, 1.0); // step gains to accelerate progress in unchanging directions
      this.ystep = randn2d(this.N, this.dim, 0.0); // momentum accumulator
      this.iter = 0;
    },

    // this function takes a given distance matrix and creates
    // matrix P from them.
    // D is assumed to be provided as a list of lists, and should be symmetric
    initDataDist(D) {
      const N = D.length;
      assert(N > 0, ' X is empty? You must have some data!');
      // convert D to a (fast) typed array version
      const dists = zeros(N * N); // allocate contiguous array
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const d = D[i][j];
          dists[i * N + j] = d;
          dists[j * N + i] = d;
        }
      }
      this.P = d2p(dists, this.perplexity, 1e-4);
      this.N = N;
      this.initSolution(); // refresh this
    },

    // (re)initializes the solution to random
    initSolution() {
      // generate random solution to t-SNE
      this.Y = randn2d(this.N, this.dim, undefined); // the solution
      this.gains = randn2d(this.N, this.dim, 1.0); // step gains to accelerate progress in unchanging directions
      this.ystep = randn2d(this.N, this.dim, 0.0); // momentum accumulator
      this.iter = 0;
    },

    // return pointer to current solution
    getSolution() {
      return this.Y;
    },

    // perform a single step of optimization to improve the embedding
    step() {
      this.iter += 1;
      const { N } = this;

      const cg = this.costGrad(this.Y); // evaluate gradient
      const { cost } = cg;
      const { grad } = cg;

      // perform gradient step
      const ymean = zeros(this.dim);
      for (var i = 0; i < N; i++) {
        for (var d = 0; d < this.dim; d++) {
          const gid = grad[i][d];
          const sid = this.ystep[i][d];
          const gainid = this.gains[i][d];

          // compute gain update
          let newgain = sign(gid) === sign(sid) ? gainid * 0.8 : gainid + 0.2;
          if (newgain < 0.01) newgain = 0.01; // clamp
          this.gains[i][d] = newgain; // store for next turn

          // compute momentum step direction
          const momval = this.iter < 250 ? 0.5 : 0.8;
          const newsid = momval * sid - this.epsilon * newgain * grad[i][d];
          this.ystep[i][d] = newsid; // remember the step we took

          // step!
          this.Y[i][d] += newsid;

          ymean[d] += this.Y[i][d]; // accumulate mean so that we can center later
        }
      }

      // reproject Y to be zero mean
      for (var i = 0; i < N; i++) {
        for (var d = 0; d < this.dim; d++) {
          this.Y[i][d] -= ymean[d] / N;
        }
      }

      // if(this.iter%100===0) console.log('iter ' + this.iter + ', cost: ' + cost);
      return cost; // return current cost
    },

    // for debugging: gradient check
    debugGrad() {
      const { N } = this;

      const cg = this.costGrad(this.Y); // evaluate gradient
      const { cost } = cg;
      const { grad } = cg;

      const e = 1e-5;
      for (let i = 0; i < N; i++) {
        for (let d = 0; d < this.dim; d++) {
          const yold = this.Y[i][d];

          this.Y[i][d] = yold + e;
          const cg0 = this.costGrad(this.Y);

          this.Y[i][d] = yold - e;
          const cg1 = this.costGrad(this.Y);

          const analytic = grad[i][d];
          const numerical = (cg0.cost - cg1.cost) / (2 * e);

          this.Y[i][d] = yold;
        }
      }
    },

    // return cost and gradient, given an arrangement
    costGrad(Y) {
      const { N } = this;
      const { dim } = this; // dim of output space
      const { P } = this;

      const pmul = this.iter < 100 ? 4 : 1; // trick that helps with local optima

      // compute current Q distribution, unnormalized first
      const Qu = zeros(N * N);
      let qsum = 0.0;
      for (var i = 0; i < N; i++) {
        for (var j = i + 1; j < N; j++) {
          let dsum = 0.0;
          for (var d = 0; d < dim; d++) {
            const dhere = Y[i][d] - Y[j][d];
            dsum += dhere * dhere;
          }
          const qu = 1.0 / (1.0 + dsum); // Student t-distribution
          Qu[i * N + j] = qu;
          Qu[j * N + i] = qu;
          qsum += 2 * qu;
        }
      }
      // normalize Q distribution to sum to 1
      const NN = N * N;
      const Q = zeros(NN);
      for (let q = 0; q < NN; q++) {
        Q[q] = Math.max(Qu[q] / qsum, 1e-100);
      }

      let cost = 0.0;
      const grad = [];
      for (var i = 0; i < N; i++) {
        const gsum = new Array(dim); // init grad for point i
        for (var d = 0; d < dim; d++) {
          gsum[d] = 0.0;
        }
        for (var j = 0; j < N; j++) {
          cost += -P[i * N + j] * Math.log(Q[i * N + j]); // accumulate cost (the non-constant portion at least...)
          const premult = 4 * (pmul * P[i * N + j] - Q[i * N + j]) * Qu[i * N + j];
          for (var d = 0; d < dim; d++) {
            gsum[d] += premult * (Y[i][d] - Y[j][d]);
          }
        }
        grad.push(gsum);
      }

      return { cost, grad };
    },
  };

  global.tSNE = tSNE; // export tSNE class
})(tsnejs);

/**
 * Worker thread that computes a stepwise projection
 */
self.addEventListener(
  'message',
  function (e) {
    const context = self as any;
    if (e.data.messageType == 'init') {
      context.raw = e.data;
      context.tsne = new tsnejs.tSNE({
        epsilon: e.data.params.learningRate,
        perplexity: e.data.params.perplexity,
        dim: 2,
        distanceFn: get_distance_fn(e.data.params.distanceMetric, e),
      });
      context.tsne.initDataSeeded(e.data.input, e.data.params.seeded ? e.data.seed : undefined);
      context.tsne.step();
      context.postMessage(context.tsne.getSolution());
    } else if (context.tsne != null) {
      context.tsne.step();
      context.postMessage(context.tsne.getSolution());
    }
  },
  false,
);

export default null as any;