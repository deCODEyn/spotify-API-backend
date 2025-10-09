export class SpotifyFetchError extends Error {
  constructor(message = "Spotify Fetch Error") {
    super(message);
    this.name = "SpotifyFetchError ";
  }
}
