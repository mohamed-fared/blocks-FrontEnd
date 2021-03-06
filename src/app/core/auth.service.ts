import { EventEmitter, Injectable, Output } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";
import { map } from "rxjs/operators";
import { Router } from "@angular/router";
import { ApolloService } from "./apollo.service";
import { SubscriptionService } from "../core/subscription.service";
import { Apollo } from "apollo-angular";
import gql from "graphql-tag";
import { SwUpdate, SwPush } from "@angular/service-worker";
@Injectable({
  providedIn: "root"
})
export class AuthService {
  private user;
  public isAuthed = !!localStorage.getItem("currentUser");
  public isSuperAdmin: boolean;
  public isAdmin: boolean;
  readonly VAPID_KEY =
    "BIDKneMUisz3eBe-_YA5eA3qm_JAPv6Uz79IIWppgjakBOjpUQYK3E6BbBfcvQaGhKsnodIJ04VYrrvpv256erY";

  @Output() getIsAuthed: EventEmitter<any> = new EventEmitter();
  constructor(
    private http: HttpClient,
    private router: Router,
    private apollo: Apollo, // private apollo: ApolloService
    private apolloService: ApolloService,
    private SwUpdate: SwUpdate,
    private SwPush: SwPush,
    private sub: SubscriptionService
  ) {
    console.log(this.isAuthed);
    this.getIsAuthed.emit(this.isAuthed);
  }
  public login(userData: any): Observable<any> {
    return this.apollo
      .watchQuery<any>({
        query: gql`
          query login($email: String!, $password: String!) {
            login(userInput: { email: $email, password: $password }) {
              token
              userId
              isAdmin
              isSuperAdmin
            }
          }
        `,
        variables: {
          email: userData.email,
          password: userData.password
        },
        errorPolicy: "all"
      })
      .valueChanges.pipe(
        map((res: any) => {
          console.log(res);

          if (res.data.login) {
            this.user = res.data.login.userId;
            this.isSuperAdmin = res.data.login.isSuperAdmin;
            this.isAdmin = res.data.login.isAdmin;
            this.saveTokenAndCurrentUser(res.data.login.token);
          }
          return res;
        })
      );
  }
  public logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    if (this.SwUpdate.isEnabled) {
      this.SwPush.requestSubscription({
        serverPublicKey: this.VAPID_KEY
      }).then(sub => {
        this.apolloService
          .deleteNotificationSub(this.user, sub.endpoint)
          .subscribe(
            res => {
              console.log(res);
            },
            err => {
              console.log(err);
            }
          );
      });
    }
    console.log(this.user);
    this.isAuthed = false;
    this.user = undefined
    console.log(this.user);
    // this.sub.status = false;
    this.sub.sub = undefined;
    this.router.navigate(["/login"]);
    this.getIsAuthed.emit(this.isAuthed);
  }
  private saveTokenAndCurrentUser(token: string): string {
    localStorage.setItem("token", token);
    console.log(this.user);
    localStorage.setItem("currentUser", this.user);
    this.isAuthenticated().subscribe(res => {
      console.log("isAuthenticated query", res);
    });
    return token;
  }
  public getToken(): string {
    return localStorage.getItem("token");
  }
  public isAuthenticated(): any {
    return this.apollo
      .watchQuery<any>({
        query: gql`
          query isAuth {
            isAuth
          }
        `,
        errorPolicy: "all"
      })
      .valueChanges.pipe(
        map((user: any) => {
          this.isAuthed =
            user.data.isAuth === localStorage.getItem("currentUser");
          console.log(user.data.isAuth);
          this.getIsAuthed.emit(this.isAuthed);
          return this.isAuthed;
        })
      );
  }
  public getCurrentUserName(): string {
    return JSON.parse(localStorage.getItem("currentUser")).name;
  }

  public isAuthSuperAndAdmin(): any {
    return this.apollo.watchQuery<any>({
      query: gql`
          query isSuperIsAdmin {
            isSuperIsAdmin(id: "${localStorage.getItem("currentUser")}") {
              isAdmin
              isSuperAdmin
            }
          }
        `,
      errorPolicy: "all"
    }).valueChanges;
  }
}
